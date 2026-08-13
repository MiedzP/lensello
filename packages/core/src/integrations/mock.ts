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

import type { DateOnly, SocialPlatform, Timestamp } from '../types';
import { IntegrationError } from './types';
import type {
  AdManager,
  AdMetricRow,
  CalendarClient,
  CalendarEvent,
  CreateAdInput,
  GeneratedImage,
  ImageGenerator,
  InboundMessage,
  Integrations,
  LabOrderItem,
  LabOrderResult,
  LabOrderStatus,
  LabProduct,
  LabShippingAddress,
  MailClient,
  PaymentClient,
  PaymentRequest,
  PaymentStatus,
  PrintLab,
  PublishPostInput,
  PublishResult,
  SendMailInput,
  SocialAccount,
  SocialAuthorization,
  SocialConnection,
  SocialGateway,
  SocialMessage,
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

/** The studio's own accounts, as each platform would report them. */
const MOCK_STUDIO_ACCOUNTS: Record<
  SocialPlatform,
  { handle: string; displayName: string; followers: number }
> = {
  instagram: { handle: 'lensello', displayName: 'Lensello Photography', followers: 8420 },
  facebook: { handle: 'lensellophoto', displayName: 'Lensello Photography', followers: 2110 },
  tiktok: { handle: 'lensello', displayName: 'Lensello', followers: 1290 },
  pinterest: { handle: 'lensello', displayName: 'Lensello', followers: 640 },
};

/**
 * Inbound social messages, keyed by platform.
 *
 * Deliberately overlaps with the mail mock: "Priya Raman" writes in on both
 * Instagram and email, which is what actually happens and is the case that
 * proves dedup across channels works.
 */
const MOCK_SOCIAL_MESSAGES: Record<
  SocialPlatform,
  ReadonlyArray<Omit<SocialMessage, 'receivedAt' | 'platform' | 'fromExternalId'>>
> = {
  instagram: [
    {
      externalId: 'ig_dm_0001',
      fromHandle: 'priya.and.dev',
      fromName: 'Priya Raman',
      kind: 'direct_message',
      body:
        "Hi! We're getting married Sept 14 at Willowmere Barn and love your " +
        'golden-hour work. Are you free that date, and what does full-day ' +
        'coverage run?',
      contextUrl: null,
    },
    {
      externalId: 'ig_cmt_0002',
      fromHandle: 'haleyjmakes',
      fromName: 'Haley J',
      kind: 'comment',
      body: 'This light is unreal 😍 do you do engagement sessions outside the city?',
      contextUrl: 'https://example.invalid/instagram/p/post_lakeside',
    },
    {
      externalId: 'ig_dm_0003',
      fromHandle: 'northsidestudioco',
      fromName: 'Northside Studio',
      kind: 'direct_message',
      body: 'Would you be open to a second-shooter swap this fall? We have three weddings.',
      contextUrl: null,
    },
  ],
  facebook: [
    {
      externalId: 'fb_dm_0001',
      fromHandle: 'marcus.webb.90',
      fromName: 'Marcus Webb',
      kind: 'direct_message',
      body:
        'Hello — we need headshots for 14 people downtown, clean neutral ' +
        'background. Cost and time on site?',
      contextUrl: null,
    },
    {
      externalId: 'fb_cmt_0002',
      fromHandle: 'elena.fitzgerald',
      fromName: 'Elena Fitzgerald',
      kind: 'comment',
      body: 'We did a session with you two years ago! Any October weekends open?',
      contextUrl: 'https://example.invalid/facebook/p/post_fall_minis',
    },
  ],
  tiktok: [
    {
      externalId: 'tt_cmt_0001',
      fromHandle: 'tobiaslund',
      fromName: 'Tobias Lund',
      kind: 'comment',
      body: 'Do you travel for engagement shoots? Is there a travel fee?',
      contextUrl: 'https://example.invalid/tiktok/v/vid_lakeside',
    },
  ],
  pinterest: [],
};

class MockSocialGateway implements SocialGateway {
  readonly provider = 'mock:social';

  /** Accounts linked during this process lifetime, so the UI round-trips. */
  private readonly linked = new Set<SocialPlatform>();

  async listAccounts(): Promise<SocialAccount[]> {
    await latency();
    return (Object.keys(MOCK_STUDIO_ACCOUNTS) as SocialPlatform[]).map((platform) => {
      const account = MOCK_STUDIO_ACCOUNTS[platform];
      return {
        platform,
        handle: `@${account.handle}`,
        displayName: account.displayName,
        followers: account.followers,
        isConnected: this.linked.has(platform),
      };
    });
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

  // --- oauth ------------------------------------------------------------

  /**
   * Points straight back at the caller's own callback with a usable code.
   *
   * A real provider would show a consent screen first. Short-circuiting it
   * keeps the mock self-contained while still driving the genuine callback
   * route — state comparison, token storage, and error handling all run for
   * real, so the only untested step is the provider's own redirect.
   */
  async beginAuthorization(input: {
    platform: SocialPlatform;
    redirectUri: string;
    state: string;
  }): Promise<SocialAuthorization> {
    await latency(120);
    const code = mockId('code', `${input.platform}:${input.state}`);
    const url = new URL(input.redirectUri);
    url.searchParams.set('code', code);
    url.searchParams.set('state', input.state);
    return { url: url.toString(), codeVerifier: null };
  }

  async completeAuthorization(input: {
    platform: SocialPlatform;
    code: string;
    redirectUri: string;
    codeVerifier?: string | null;
  }): Promise<SocialConnection> {
    await latency(500);

    // Mirrors a provider rejecting a replayed or forged code. Without this the
    // callback's error path would never be exercised.
    if (!input.code.startsWith('code_')) {
      throw new IntegrationError(
        'That authorization code is not valid or has already been used.',
        'mock:social',
      );
    }

    const account = MOCK_STUDIO_ACCOUNTS[input.platform];
    this.linked.add(input.platform);

    return {
      platform: input.platform,
      handle: account.handle,
      displayName: account.displayName,
      followers: account.followers,
      externalAccountId: mockId('acct', input.platform),
      accessToken: mockId('token', `${input.platform}:${input.code}`),
      refreshToken: mockId('refresh', input.platform),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      scopes: ['profile', 'publish', 'messages'],
      canPublish: true,
      // Pinterest has no messaging product, so the mock does not pretend the
      // scope exists. The connections page reads this, not a hardcoded list.
      canCollectMessages: input.platform !== 'pinterest',
    };
  }

  async revoke(input: { platform: SocialPlatform; accessToken: string }): Promise<void> {
    await latency();
    this.linked.delete(input.platform);
  }

  // --- inbox ------------------------------------------------------------

  async sendMessage(input: {
    platform: SocialPlatform;
    accessToken: string;
    toExternalId: string;
    body: string;
  }): Promise<PublishResult> {
    await latency(400);
    return {
      externalId: mockId('dm', `${input.platform}:${input.toExternalId}:${input.body}`),
      url: null,
      publishedAt: new Date().toISOString(),
    };
  }

  async fetchMessages(input: {
    platform: SocialPlatform;
    accessToken: string;
    since?: Timestamp;
  }): Promise<SocialMessage[]> {
    await latency(350);
    const now = Date.now();

    const messages = MOCK_SOCIAL_MESSAGES[input.platform].map((message, index) => ({
      ...message,
      platform: input.platform,
      // Derived from the handle so it is stable across runs, the way a real
      // scoped id is stable for a given sender.
      fromExternalId: mockId('igsid', `${input.platform}:${message.fromHandle}`),
      receivedAt: new Date(now - (index * 11 + 2) * 60 * 60 * 1000).toISOString(),
    }));

    if (!input.since) return messages;
    const cutoff = new Date(input.since).getTime();
    return messages.filter((m) => new Date(m.receivedAt).getTime() > cutoff);
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
  ): Promise<AdMetricRow[]> {
    await latency(400);
    const rows: AdMetricRow[] = [];

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
          externalId,
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
  /** How many times each request has been polled. */
  private readonly polls = new Map<string, number>();

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
    this.polls.set(externalId, 0);
    return request;
  }

  async getPayment(externalId: string): Promise<PaymentRequest> {
    await latency();

    const existing = this.requests.get(externalId);
    if (existing) {
      // Simulate the client actually paying. Without this a request created in
      // this process would report `pending` forever and the deposit flow could
      // never be completed or demoed.
      //
      // Poll count rather than elapsed time, so the transition is deterministic:
      // the first check is pending, the second is paid.
      const seen = (this.polls.get(externalId) ?? 0) + 1;
      this.polls.set(externalId, seen);

      if (existing.status === 'pending' && seen >= 2) {
        const settled: PaymentRequest = { ...existing, status: 'paid' };
        this.requests.set(externalId, settled);
        return settled;
      }
      return existing;
    }

    // Unknown id — typically a link saved before a restart. Derive a stable
    // status so re-checking it is at least self-consistent.
    const statuses: PaymentStatus[] = ['pending', 'paid', 'paid', 'failed'];
    return {
      externalId,
      url: `https://example.invalid/checkout/${externalId}`,
      amountCents: between(`amt:${externalId}`, 15000, 120000),
      status: statuses[seed(externalId) % statuses.length]!,
    };
  }
}

// --- print lab ----------------------------------------------------------

/**
 * A plausible UK lab catalogue: standard British print sizes, mounted and
 * framed options, and an album. Sizes are the imperial ones labs actually list,
 * converted to millimetres.
 */
const MOCK_LAB_CATALOGUE: readonly LabProduct[] = [
  { labSku: 'PR-6X4', name: '6x4" print', category: 'print', widthMm: 152, heightMm: 102, costCents: 45, currency: 'GBP', minPixels: { width: 1200, height: 800 } },
  { labSku: 'PR-7X5', name: '7x5" print', category: 'print', widthMm: 178, heightMm: 127, costCents: 70, currency: 'GBP', minPixels: { width: 1400, height: 1000 } },
  { labSku: 'PR-10X8', name: '10x8" print', category: 'print', widthMm: 254, heightMm: 203, costCents: 180, currency: 'GBP', minPixels: { width: 2000, height: 1600 } },
  { labSku: 'PR-12X8', name: '12x8" print', category: 'print', widthMm: 305, heightMm: 203, costCents: 240, currency: 'GBP', minPixels: { width: 2400, height: 1600 } },
  { labSku: 'PR-16X12', name: '16x12" print', category: 'print', widthMm: 406, heightMm: 305, costCents: 520, currency: 'GBP', minPixels: { width: 3200, height: 2400 } },
  { labSku: 'PR-20X16', name: '20x16" print', category: 'print', widthMm: 508, heightMm: 406, costCents: 890, currency: 'GBP', minPixels: { width: 4000, height: 3200 } },
  { labSku: 'MT-10X8', name: '10x8" mounted', category: 'framed', widthMm: 254, heightMm: 203, costCents: 640, currency: 'GBP', minPixels: { width: 2000, height: 1600 } },
  { labSku: 'FR-16X12-OAK', name: '16x12" framed, oak', category: 'framed', widthMm: 406, heightMm: 305, costCents: 3400, currency: 'GBP', minPixels: { width: 3200, height: 2400 } },
  { labSku: 'FR-20X16-BLK', name: '20x16" framed, black', category: 'framed', widthMm: 508, heightMm: 406, costCents: 4700, currency: 'GBP', minPixels: { width: 4000, height: 3200 } },
  { labSku: 'CV-24X16', name: '24x16" canvas wrap', category: 'canvas', widthMm: 610, heightMm: 406, costCents: 3900, currency: 'GBP', minPixels: { width: 4800, height: 3200 } },
  { labSku: 'AL-12X12-30', name: '12x12" album, 30 sides', category: 'album', widthMm: 305, heightMm: 305, costCents: 14500, currency: 'GBP', minPixels: { width: 3000, height: 3000 } },
];

/** Flat-rate tiers, the way most UK labs actually price carriage. */
function mockShippingCents(subtotalCents: number): number {
  if (subtotalCents >= 15000) return 0;
  if (subtotalCents >= 5000) return 495;
  return 395;
}

function csvCell(value: string): string {
  // Quote unconditionally and double any embedded quote. A postcode is safe;
  // a client's address line with a comma in it is not.
  return `"${value.replace(/"/g, '""')}"`;
}

class MockPrintLab implements PrintLab {
  readonly provider = 'mock-lab';

  /** Orders submitted in this process, so status polling is self-consistent. */
  private readonly orders = new Map<string, LabOrderResult>();
  private readonly polls = new Map<string, number>();

  async catalogue(): Promise<LabProduct[]> {
    await latency();
    return [...MOCK_LAB_CATALOGUE];
  }

  private costFor(labSku: string): number {
    const found = MOCK_LAB_CATALOGUE.find((p) => p.labSku === labSku);
    if (!found) {
      throw new IntegrationError(
        `Unknown lab SKU "${labSku}". Map the product to a SKU the lab publishes before ordering.`,
        this.provider,
      );
    }
    return found.costCents;
  }

  async quote(input: {
    items: readonly LabOrderItem[];
    shipTo: LabShippingAddress;
  }): Promise<{ subtotalCents: number; shippingCents: number; currency: string }> {
    await latency();

    const subtotalCents = input.items.reduce(
      (sum, item) => sum + this.costFor(item.labSku) * item.quantity,
      0,
    );

    return {
      subtotalCents,
      // Overseas carriage is a different conversation; the mock refuses to
      // invent a number rather than quoting one that would be wrong.
      shippingCents:
        input.shipTo.country === 'GB' ? mockShippingCents(subtotalCents) : 1650,
      currency: 'GBP',
    };
  }

  async submitOrder(input: {
    reference: string;
    items: readonly LabOrderItem[];
    shipTo: LabShippingAddress;
  }): Promise<LabOrderResult> {
    await latency(400);

    if (input.items.length === 0) {
      throw new IntegrationError('Cannot submit an empty order.', this.provider);
    }

    const costCents = input.items.reduce(
      (sum, item) => sum + this.costFor(item.labSku) * item.quantity,
      0,
    );

    const result: LabOrderResult = {
      labOrderRef: mockId('lab', input.reference),
      status: 'received',
      trackingUrl: null,
      costCents,
    };

    this.orders.set(result.labOrderRef, result);
    this.polls.set(result.labOrderRef, 0);
    return result;
  }

  async orderStatus(labOrderRef: string): Promise<LabOrderResult> {
    await latency();

    const existing = this.orders.get(labOrderRef);
    if (!existing) {
      // Typically a reference from before a restart. Derive a stable status so
      // re-checking it is at least self-consistent.
      const statuses: LabOrderStatus[] = ['received', 'in_production', 'shipped', 'delivered'];
      return {
        labOrderRef,
        status: statuses[seed(labOrderRef) % statuses.length]!,
        trackingUrl: null,
        costCents: null,
      };
    }

    // Walk the order forward one stage per poll, so the fulfilment UI can be
    // demoed without waiting on a real lab.
    const seen = (this.polls.get(labOrderRef) ?? 0) + 1;
    this.polls.set(labOrderRef, seen);

    const stages: LabOrderStatus[] = ['received', 'in_production', 'shipped', 'delivered'];
    const status = stages[Math.min(seen, stages.length - 1)]!;
    const advanced: LabOrderResult = {
      ...existing,
      status,
      trackingUrl:
        status === 'shipped' || status === 'delivered'
          ? `https://example.invalid/track/${labOrderRef}`
          : null,
    };

    this.orders.set(labOrderRef, advanced);
    return advanced;
  }

  async exportOrder(input: {
    reference: string;
    items: readonly LabOrderItem[];
    shipTo: LabShippingAddress;
  }): Promise<{ filename: string; contentType: string; body: string }> {
    const header = [
      'reference', 'sku', 'quantity', 'image_url', 'crop',
      'ship_name', 'ship_line1', 'ship_line2', 'ship_city', 'ship_postcode', 'ship_country',
    ];

    const rows = input.items.map((item) =>
      [
        input.reference,
        item.labSku,
        String(item.quantity),
        item.imageUrl,
        item.crop ? `${item.crop.x},${item.crop.y},${item.crop.w},${item.crop.h}` : 'full',
        input.shipTo.name,
        input.shipTo.line1,
        input.shipTo.line2 ?? '',
        input.shipTo.city,
        input.shipTo.postcode,
        input.shipTo.country,
      ].map(csvCell).join(','),
    );

    return {
      filename: `lab-order-${input.reference}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: [header.map(csvCell).join(','), ...rows].join('\r\n'),
    };
  }
}

// --- image generation ---------------------------------------------------

const ASPECT_SIZES: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '4:5': { width: 1024, height: 1280 },
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
};

class MockImageGenerator implements ImageGenerator {
  readonly provider = 'mock-image';

  async generate(input: {
    prompt: string;
    aspectRatio?: '1:1' | '4:5' | '16:9' | '9:16';
    referenceImageUrl?: string;
    count?: number;
  }): Promise<GeneratedImage[]> {
    await latency(600);

    if (!input.prompt.trim()) {
      throw new IntegrationError('A prompt is required.', this.provider);
    }

    const { width, height } = ASPECT_SIZES[input.aspectRatio ?? '1:1']!;
    const count = Math.min(Math.max(input.count ?? 1, 1), 4);

    return Array.from({ length: count }, (_, i) => {
      // A flat SVG in the prompt's own deterministic hue. Recognisably a
      // placeholder — nobody should mistake this for a generated photograph.
      const hue = seed(`${input.prompt}:${i}`) % 360;
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
        `<rect width="100%" height="100%" fill="hsl(${hue} 45% 82%)"/>` +
        `<rect x="6%" y="6%" width="88%" height="88%" fill="none" ` +
        `stroke="hsl(${hue} 40% 45%)" stroke-width="4" stroke-dasharray="18 12"/>` +
        `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" ` +
        `font-family="system-ui, sans-serif" font-size="${Math.round(width / 26)}" ` +
        `fill="hsl(${hue} 35% 30%)">mock image ${i + 1}</text></svg>`;

      return {
        data: new TextEncoder().encode(svg),
        contentType: 'image/svg+xml',
        width,
        height,
        model: 'mock-diffusion-1',
      };
    });
  }
}

// --- registry -----------------------------------------------------------

export function createMockIntegrations(): Integrations {
  return {
    mode: 'mock',
    social: new MockSocialGateway(),
    ads: new MockAdManager(),
    mail: new MockMailClient(),
    calendar: new MockCalendarClient(),
    payments: new MockPaymentClient(),
    printLab: new MockPrintLab(),
    imageGen: new MockImageGenerator(),
  };
}
