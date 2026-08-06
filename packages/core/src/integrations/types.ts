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
  /**
   * Token for the linked account being published to.
   *
   * Optional because the mock ignores it. A live adapter must reject a call
   * that arrives without one rather than falling back to any ambient
   * credential — publishing to the wrong studio account is not recoverable.
   */
  accessToken?: string;
}

export interface SocialPublisher {
  readonly provider: string;
  listAccounts(): Promise<SocialAccount[]>;
  publish(input: PublishPostInput): Promise<PublishResult>;
  /** Best-effort delete. Platforms differ on whether this is possible. */
  unpublish(externalId: string): Promise<void>;
}

// --- linking an account (OAuth) -----------------------------------------

export interface SocialAuthorization {
  /** Where to send the browser to grant access. */
  url: string;
  /**
   * PKCE verifier the callback must present, for providers that require one.
   * Null when the flow does not use PKCE.
   */
  codeVerifier: string | null;
}

/** Everything needed to persist a newly linked account. */
export interface SocialConnection {
  platform: SocialPlatform;
  handle: string;
  displayName: string;
  followers: number;
  externalAccountId: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Timestamp | null;
  scopes: string[];
  /**
   * What the granted scopes actually permit. Reported by the adapter rather
   * than assumed per platform: the same platform grants different capabilities
   * depending on what the user consented to, and on whether the app has been
   * through review.
   */
  canPublish: boolean;
  canCollectMessages: boolean;
}

export interface SocialOAuth {
  /**
   * `redirectUri` must exactly match one registered with the provider.
   *
   * `state` is generated and stored by the caller, not by the adapter — it has
   * to be compared against something the browser carries back, and only the
   * caller owns that cookie. Without the comparison, a third party can walk a
   * staff member into linking an account the studio does not own.
   */
  beginAuthorization(input: {
    platform: SocialPlatform;
    redirectUri: string;
    state: string;
  }): Promise<SocialAuthorization>;

  completeAuthorization(input: {
    platform: SocialPlatform;
    code: string;
    redirectUri: string;
    codeVerifier?: string | null;
  }): Promise<SocialConnection>;

  /** Best effort. An already-revoked or expired token is not an error. */
  revoke(input: {
    platform: SocialPlatform;
    accessToken: string;
  }): Promise<void>;
}

// --- inbound social messages --------------------------------------------

/** A DM, comment, or mention. All three can be an inquiry worth replying to. */
export interface SocialMessage {
  externalId: string;
  platform: SocialPlatform;
  /** As the platform reports it. Normalize before using it as a key. */
  fromHandle: string;
  fromName: string;
  kind: 'direct_message' | 'comment' | 'mention';
  body: string;
  receivedAt: Timestamp;
  /** The post being commented on, when the message is not a DM. */
  contextUrl: string | null;
}

export interface SocialInbox {
  /** Newest first. `since` narrows the sync window. */
  fetchMessages(input: {
    platform: SocialPlatform;
    accessToken: string;
    since?: Timestamp;
  }): Promise<SocialMessage[]>;
}

/**
 * Everything Lensello does with a social platform: link it, post to it, and
 * read what comes back. Composed from the three interfaces above so each can
 * be implemented and reasoned about separately.
 */
export interface SocialGateway
  extends SocialPublisher,
    SocialOAuth,
    SocialInbox {}

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

/**
 * One day of metrics for one ad.
 *
 * `externalId` is what makes a multi-ad fetch usable: without it the caller
 * cannot tell which ad a row belongs to, and attributing spend by guesswork
 * charges the wrong ad.
 */
export interface AdMetricRow extends Omit<AdMetric, 'id' | 'adId'> {
  externalId: string;
}

export interface AdManager {
  readonly provider: string;
  createAd(input: CreateAdInput): Promise<PublishResult>;
  setAdStatus(externalId: string, active: boolean): Promise<void>;
  /**
   * Daily metrics for a window, inclusive of both endpoints. Each row names the
   * ad it belongs to, so one call can cover many ads.
   */
  fetchMetrics(
    externalIds: readonly string[],
    from: DateOnly,
    to: DateOnly,
  ): Promise<AdMetricRow[]>;
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
  readonly social: SocialGateway;
  readonly ads: AdManager;
  readonly mail: MailClient;
  readonly calendar: CalendarClient;
  readonly payments: PaymentClient;
}
