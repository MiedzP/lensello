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
  DriveFile,
  DriveFolder,
  DriveImage,
  DriveSource,
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

// --- drive (photo import) -------------------------------------------------

/**
 * A minimal 1x1 transparent PNG, reused for every fixture file.
 *
 * The import pipeline trusts `DriveImage.width`/`height` from listing
 * metadata rather than decoding bytes, so the mock's bytes never need to
 * actually match the fixture dimensions — only be a well-formed image so a
 * real upload to Storage succeeds end-to-end in mock mode.
 */
const MOCK_IMAGE_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

interface MockDriveFixtureFile {
  id: string;
  name: string;
  width: number;
  height: number;
  daysAgo: number;
}

interface MockDriveFixtureFolder {
  folder: DriveFolder;
  files: MockDriveFixtureFile[];
}

/**
 * Fixture folders standing in for what the studio would actually share:
 * in-house work and personal photography, kept apart from client shoots —
 * exactly what the client described wanting reachable for marketing.
 */
const MOCK_DRIVE_FOLDERS: MockDriveFixtureFolder[] = [
  {
    folder: { id: 'folder_inhouse_speeches', name: 'In-house — Wedding Speeches' },
    files: [
      { id: 'file_speech_001', name: 'groom_speech_01.jpg', width: 4000, height: 2667, daysAgo: 40 },
      { id: 'file_speech_002', name: 'groom_speech_02.jpg', width: 4000, height: 2667, daysAgo: 40 },
      { id: 'file_speech_003', name: 'groom_speech_03.jpg', width: 3600, height: 2400, daysAgo: 40 },
      { id: 'file_speech_004', name: 'best_man_speech_01.jpg', width: 4000, height: 2667, daysAgo: 40 },
      { id: 'file_speech_005', name: 'best_man_speech_02.jpg', width: 4000, height: 2667, daysAgo: 40 },
      { id: 'file_speech_006', name: 'father_of_bride_01.jpg', width: 3600, height: 2400, daysAgo: 40 },
      { id: 'file_speech_007', name: 'toast_wide_01.jpg', width: 5000, height: 3333, daysAgo: 40 },
      { id: 'file_speech_008', name: 'toast_wide_02.jpg', width: 5000, height: 3333, daysAgo: 40 },
      { id: 'file_speech_009', name: 'guests_laughing_01.jpg', width: 4000, height: 2667, daysAgo: 40 },
      { id: 'file_speech_010', name: 'guests_laughing_02.jpg', width: 4000, height: 2667, daysAgo: 40 },
    ],
  },
  {
    folder: { id: 'folder_family_album', name: 'Family Album — Beach Day' },
    files: [
      { id: 'file_beach_001', name: 'beach_family_01.jpg', width: 4032, height: 3024, daysAgo: 120 },
      { id: 'file_beach_002', name: 'beach_family_02.jpg', width: 4032, height: 3024, daysAgo: 120 },
      { id: 'file_beach_003', name: 'beach_kids_running.jpg', width: 4032, height: 3024, daysAgo: 120 },
      { id: 'file_beach_004', name: 'beach_sunset_group.jpg', width: 5472, height: 3648, daysAgo: 120 },
      { id: 'file_beach_005', name: 'beach_sandcastle.jpg', width: 4032, height: 3024, daysAgo: 120 },
      { id: 'file_beach_006', name: 'beach_picnic.jpg', width: 4032, height: 3024, daysAgo: 120 },
    ],
  },
  {
    folder: { id: 'folder_studio_bts', name: 'Studio — Behind the Scenes' },
    files: [
      { id: 'file_bts_001', name: 'studio_setup_01.jpg', width: 3000, height: 2000, daysAgo: 15 },
      { id: 'file_bts_002', name: 'studio_setup_02.jpg', width: 3000, height: 2000, daysAgo: 15 },
      { id: 'file_bts_003', name: 'lighting_test_01.jpg', width: 3000, height: 2000, daysAgo: 15 },
      { id: 'file_bts_004', name: 'lighting_test_02.jpg', width: 3000, height: 2000, daysAgo: 15 },
    ],
  },
];

function toMockDriveImage(file: MockDriveFixtureFile): DriveImage {
  return {
    id: file.id,
    name: file.name,
    mimeType: 'image/jpeg',
    byteSize: between(`size:${file.id}`, 1_800_000, 9_500_000),
    width: file.width,
    height: file.height,
    modifiedTime: new Date(Date.now() - file.daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  };
}

class MockDriveSource implements DriveSource {
  readonly provider = 'mock:google-drive';

  async listFolders(): Promise<DriveFolder[]> {
    await latency(200);
    return MOCK_DRIVE_FOLDERS.map((entry) => entry.folder);
  }

  async listImages(folderId: string): Promise<DriveImage[]> {
    await latency(300);
    const entry = MOCK_DRIVE_FOLDERS.find((candidate) => candidate.folder.id === folderId);
    if (!entry) {
      throw new IntegrationError(
        `No folder "${folderId}" is shared with the service account.`,
        'mock:google-drive',
      );
    }
    return entry.files.map(toMockDriveImage);
  }

  async downloadFile(fileId: string): Promise<DriveFile> {
    await latency(250);
    const found = MOCK_DRIVE_FOLDERS.flatMap((entry) => entry.files).find(
      (file) => file.id === fileId,
    );
    if (!found) {
      throw new IntegrationError(`No file "${fileId}" is visible to the service account.`, 'mock:google-drive');
    }
    return { bytes: MOCK_IMAGE_BYTES, mimeType: 'image/jpeg' };
  }

  async fetchThumbnail(fileId: string): Promise<DriveFile | null> {
    await latency(120);
    const found = MOCK_DRIVE_FOLDERS.flatMap((entry) => entry.files).find(
      (file) => file.id === fileId,
    );
    if (!found) return null;
    return { bytes: MOCK_IMAGE_BYTES, mimeType: 'image/jpeg' };
  }
}

/**
 * Standalone rather than part of `createMockIntegrations()` / `Integrations`:
 * Drive is configured from the environment like Calendar, not per request, so
 * it is resolved the same way Calendar is — see `getDriveSource()` in
 * `index.ts` — and does not belong on the shared registry interface.
 */
export function createMockDriveSource(): DriveSource {
  return new MockDriveSource();
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
  };
}
