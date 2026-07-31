/**
 * Mock integration adapters.
 *
 * These are the only implementations wired up today. They return deterministic,
 * realistic-looking data so the whole product is demoable without Meta app
 * review, Google OAuth verification, or a live Stripe account.
 *
 * Determinism matters: values are derived from a seeded hash rather than
 * `Math.random()`, so screenshots and tests are stable across runs.
 */

import type { AdMetric, DateOnly, Timestamp } from '../types';
import type {
  AdManager,
  CalendarClient,
  CalendarEvent,
  CreateAdInput,
  InboundMessage,
  Integrations,
  MailClient,
  PaymentClient,
  PaymentRequest,
  PaymentStatus,
  PublishPostInput,
  PublishResult,
  SendMailInput,
  SocialAccount,
  SocialPublisher,
} from './types';

/** Small deterministic string hash, used in place of randomness. */
function seed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Deterministic integer in [min, max]. */
function between(key: string, min: number, max: number): number {
  return min + (seed(key) % (max - min + 1));
}

function mockId(prefix: string, key: string): string {
  return `${prefix}_${seed(key).toString(36).padStart(8, '0')}`;
}

/** Simulates the latency of a real API call so loading states are exercised. */
function latency(ms = 220): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function eachDay(from: DateOnly, to: DateOnly): DateOnly[] {
  const days: DateOnly[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

// --- social -------------------------------------------------------------

class MockSocialPublisher implements SocialPublisher {
  readonly provider = 'mock:social';

  async listAccounts(): Promise<SocialAccount[]> {
    await latency();
    return [
      {
        platform: 'instagram',
        handle: '@lensello',
        displayName: 'Lensello Photography',
        followers: 8420,
        isConnected: true,
      },
      {
        platform: 'facebook',
        handle: 'lensellophoto',
        displayName: 'Lensello Photography',
        followers: 2110,
        isConnected: true,
      },
      {
        platform: 'tiktok',
        handle: '@lensello',
        displayName: 'Lensello',
        followers: 1290,
        isConnected: false,
      },
      {
        platform: 'pinterest',
        handle: 'lensello',
        displayName: 'Lensello',
        followers: 640,
        isConnected: false,
      },
    ];
  }

  async publish(input: PublishPostInput): Promise<PublishResult> {
    await latency(600);
    const key = `${input.platform}:${input.caption}`;
    const externalId = mockId('post', key);
    return {
      externalId,
      url: `https://example.invalid/${input.platform}/p/${externalId}`,
      publishedAt: input.scheduledFor ?? new Date().toISOString(),
    };
  }

  async unpublish(): Promise<void> {
    await latency();
  }
}

// --- ads ----------------------------------------------------------------

class MockAdManager implements AdManager {
  readonly provider = 'mock:ads';

  async createAd(input: CreateAdInput): Promise<PublishResult> {
    await latency(500);
    return {
      externalId: mockId('ad', `${input.platform}:${input.name}`),
      url: null,
      publishedAt: new Date().toISOString(),
    };
  }

  async setAdStatus(): Promise<void> {
    await latency();
  }

  async fetchMetrics(
    externalIds: readonly string[],
    from: DateOnly,
    to: DateOnly,
  ): Promise<Omit<AdMetric, 'id' | 'adId'>[]> {
    await latency(400);
    const rows: Omit<AdMetric, 'id' | 'adId'>[] = [];

    for (const externalId of externalIds) {
      for (const day of eachDay(from, to)) {
        const key = `${externalId}:${day}`;
        const impressions = between(`imp:${key}`, 400, 3200);
        // Keep CTR in a believable 0.6%-3.2% band for photography creative.
        const clicks = Math.max(
          1,
          Math.round((impressions * between(`ctr:${key}`, 6, 32)) / 1000),
        );
        rows.push({
          day,
          impressions,
          clicks,
          spendCents: between(`spend:${key}`, 800, 4500),
          // Most days produce no lead; that is the realistic case.
          leads: between(`lead:${key}`, 0, 9) >= 7 ? 1 : 0,
        });
      }
    }

    return rows;
  }
}

// --- mail ---------------------------------------------------------------

const MOCK_INQUIRIES: ReadonlyArray<Omit<InboundMessage, 'receivedAt'>> = [
  {
    externalId: 'mail_0001',
    fromName: 'Priya Raman',
    fromEmail: 'priya.raman@example.invalid',
    subject: 'Wedding photography — Sept 14',
    body:
      "Hi! We're getting married on September 14th at Willowmere Barn and love " +
      'your work, especially the golden-hour portraits. We expect about 120 guests. ' +
      'Could you send over pricing for full-day coverage and let us know if that ' +
      'date is still open?\n\nThanks,\nPriya & Dev',
  },
  {
    externalId: 'mail_0002',
    fromName: 'Marcus Webb',
    fromEmail: 'm.webb@example.invalid',
    subject: 'Corporate headshots for our team',
    body:
      'Hello — we need updated headshots for 14 people at our office downtown. ' +
      'Looking for something clean on a neutral background. What would that cost ' +
      'and how long would you need on site?\n\nMarcus',
  },
  {
    externalId: 'mail_0003',
    fromName: 'Elena Fitzgerald',
    fromEmail: 'elena.fitz@example.invalid',
    subject: 'Family session this fall?',
    body:
      "We did a session with you two years ago and would love to do another now " +
      'that the kids are older. Do you have anything in October? Weekend mornings ' +
      'work best for us.\n\nElena',
  },
  {
    externalId: 'mail_0004',
    fromName: 'Tobias Lund',
    fromEmail: 'tobias@example.invalid',
    subject: 'Engagement shoot — quick question',
    body:
      'Loved the lakeside set you posted last week. Do you travel outside the city ' +
      'for engagement sessions, and is there a travel fee?\n\nTobias',
  },
];

class MockMailClient implements MailClient {
  readonly provider = 'mock:mail';

  async fetchInbox(since?: Timestamp): Promise<InboundMessage[]> {
    await latency(350);
    const now = Date.now();

    const messages = MOCK_INQUIRIES.map((inquiry, index) => ({
      ...inquiry,
      // Spread arrivals across the past few days, newest first.
      receivedAt: new Date(
        now - (index * 19 + 3) * 60 * 60 * 1000,
      ).toISOString(),
    }));

    if (!since) return messages;
    const cutoff = new Date(since).getTime();
    return messages.filter((m) => new Date(m.receivedAt).getTime() > cutoff);
  }

  async send(input: SendMailInput): Promise<PublishResult> {
    await latency(450);
    return {
      externalId: mockId('sent', `${input.toEmail}:${input.subject}`),
      url: null,
      publishedAt: new Date().toISOString(),
    };
  }
}

// --- calendar -----------------------------------------------------------

class MockCalendarClient implements CalendarClient {
  readonly provider = 'mock:calendar';
  /** Events created during this process lifetime, so the UI round-trips. */
  private readonly created = new Map<string, CalendarEvent>();

  async listEvents(from: Timestamp, to: Timestamp): Promise<CalendarEvent[]> {
    await latency();
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    return [...this.created.values()].filter((event) => {
      const startsMs = new Date(event.startsAt).getTime();
      return startsMs >= fromMs && startsMs <= toMs;
    });
  }

  async createEvent(
    event: Omit<CalendarEvent, 'externalId'>,
  ): Promise<PublishResult> {
    await latency(300);
    const externalId = mockId('evt', `${event.title}:${event.startsAt}`);
    this.created.set(externalId, { ...event, externalId });
    return {
      externalId,
      url: `https://example.invalid/calendar/${externalId}`,
      publishedAt: new Date().toISOString(),
    };
  }

  async updateEvent(
    externalId: string,
    event: Partial<Omit<CalendarEvent, 'externalId'>>,
  ): Promise<void> {
    await latency();
    const existing = this.created.get(externalId);
    if (existing) this.created.set(externalId, { ...existing, ...event });
  }

  async deleteEvent(externalId: string): Promise<void> {
    await latency();
    this.created.delete(externalId);
  }
}

// --- payments -----------------------------------------------------------

class MockPaymentClient implements PaymentClient {
  readonly provider = 'mock:payments';
  private readonly requests = new Map<string, PaymentRequest>();

  async requestPayment(input: {
    gigId: string;
    amountCents: number;
    description: string;
    clientEmail: string | null;
  }): Promise<PaymentRequest> {
    await latency(400);
    const externalId = mockId('pay', `${input.gigId}:${input.amountCents}`);
    const request: PaymentRequest = {
      externalId,
      url: `https://example.invalid/checkout/${externalId}`,
      amountCents: input.amountCents,
      status: 'pending',
    };
    this.requests.set(externalId, request);
    return request;
  }

  async getPayment(externalId: string): Promise<PaymentRequest> {
    await latency();
    const existing = this.requests.get(externalId);
    if (existing) return existing;

    // Unknown id: derive a stable status so refreshing a saved link is sane.
    const statuses: PaymentStatus[] = ['pending', 'paid', 'paid', 'failed'];
    return {
      externalId,
      url: `https://example.invalid/checkout/${externalId}`,
      amountCents: between(`amt:${externalId}`, 15000, 120000),
      status: statuses[seed(externalId) % statuses.length]!,
    };
  }
}

// --- registry -----------------------------------------------------------

export function createMockIntegrations(): Integrations {
  return {
    mode: 'mock',
    social: new MockSocialPublisher(),
    ads: new MockAdManager(),
    mail: new MockMailClient(),
    calendar: new MockCalendarClient(),
    payments: new MockPaymentClient(),
  };
}
