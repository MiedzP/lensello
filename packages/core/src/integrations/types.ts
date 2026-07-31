/**
 * Integration boundaries.
 *
 * Every third-party system Lensello touches sits behind one of these
 * interfaces. Modules depend on the interface, never on a vendor SDK, so
 * swapping mock -> live is a change in exactly one place.
 *
 * Adding a capability: extend the interface here, implement it in the mock,
 * and leave the live implementation throwing `NotImplementedError` until the
 * corresponding API access is actually approved.
 */

import type {
  AdMetric,
  AdPlatform,
  Cents,
  DateOnly,
  SocialPlatform,
  Timestamp,
  UUID,
} from '../types';

export class IntegrationError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

export class NotImplementedError extends IntegrationError {
  constructor(provider: string, capability: string) {
    super(
      `${provider} does not implement ${capability} yet. ` +
        `Live credentials and API approval are still pending.`,
      provider,
    );
    this.name = 'NotImplementedError';
  }
}

/** Result of any outbound write, so callers can record provenance. */
export interface PublishResult {
  externalId: string;
  url: string | null;
  publishedAt: Timestamp;
}

// --- social publishing --------------------------------------------------

export interface SocialAccount {
  platform: SocialPlatform;
  handle: string;
  displayName: string;
  followers: number;
  /** False when the token is missing or expired — surface this in the UI. */
  isConnected: boolean;
}

export interface PublishPostInput {
  platform: SocialPlatform;
  caption: string;
  hashtags: string[];
  /** Publicly reachable image URLs. Ordered; index 0 is the cover. */
  imageUrls: string[];
  /** Omit to publish immediately. */
  scheduledFor?: Timestamp;
}

export interface SocialPublisher {
  readonly provider: string;
  listAccounts(): Promise<SocialAccount[]>;
  publish(input: PublishPostInput): Promise<PublishResult>;
  /** Best-effort delete. Platforms differ on whether this is possible. */
  unpublish(externalId: string): Promise<void>;
}

// --- advertising --------------------------------------------------------

export interface CreateAdInput {
  platform: AdPlatform;
  name: string;
  headline: string;
  primaryText: string;
  callToAction: string;
  imageUrl: string | null;
  dailyBudgetCents: Cents;
  audience: string | null;
  startsOn: DateOnly | null;
  endsOn: DateOnly | null;
}

export interface AdManager {
  readonly provider: string;
  createAd(input: CreateAdInput): Promise<PublishResult>;
  setAdStatus(externalId: string, active: boolean): Promise<void>;
  /** Daily metrics for a window, inclusive of both endpoints. */
  fetchMetrics(
    externalIds: readonly string[],
    from: DateOnly,
    to: DateOnly,
  ): Promise<Omit<AdMetric, 'id' | 'adId'>[]>;
}

// --- inbound mail -------------------------------------------------------

export interface InboundMessage {
  externalId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  receivedAt: Timestamp;
}

export interface SendMailInput {
  toEmail: string;
  toName: string | null;
  subject: string;
  body: string;
  /** Thread to reply within, when continuing a conversation. */
  inReplyTo?: string;
}

export interface MailClient {
  readonly provider: string;
  /** Newest first. `since` narrows the sync window. */
  fetchInbox(since?: Timestamp): Promise<InboundMessage[]>;
  send(input: SendMailInput): Promise<PublishResult>;
}

// --- calendar -----------------------------------------------------------

export interface CalendarEvent {
  externalId: string;
  title: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  location: string | null;
}

export interface CalendarClient {
  readonly provider: string;
  listEvents(from: Timestamp, to: Timestamp): Promise<CalendarEvent[]>;
  createEvent(event: Omit<CalendarEvent, 'externalId'>): Promise<PublishResult>;
  updateEvent(
    externalId: string,
    event: Partial<Omit<CalendarEvent, 'externalId'>>,
  ): Promise<void>;
  deleteEvent(externalId: string): Promise<void>;
}

// --- payments -----------------------------------------------------------

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface PaymentRequest {
  externalId: string;
  /** Hosted checkout URL to send the client. */
  url: string;
  amountCents: Cents;
  status: PaymentStatus;
}

export interface PaymentClient {
  readonly provider: string;
  /** Deposit or balance request tied to a gig. */
  requestPayment(input: {
    gigId: UUID;
    amountCents: Cents;
    description: string;
    clientEmail: string | null;
  }): Promise<PaymentRequest>;
  getPayment(externalId: string): Promise<PaymentRequest>;
}

// --- registry -----------------------------------------------------------

export type IntegrationMode = 'mock' | 'live';

export interface Integrations {
  readonly mode: IntegrationMode;
  readonly social: SocialPublisher;
  readonly ads: AdManager;
  readonly mail: MailClient;
  readonly calendar: CalendarClient;
  readonly payments: PaymentClient;
}
