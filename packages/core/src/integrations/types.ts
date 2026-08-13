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
  /**
   * The platform's own id for the sender.
   *
   * Required to reply: messaging APIs address a scoped user id, not a handle.
   * Null when the platform does not supply one, in which case a reply cannot
   * be sent and the caller must say so rather than guess a recipient.
   */
  fromExternalId: string | null;
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

  /**
   * Replies to a conversation on the platform it happened on.
   *
   * `toExternalId` is the recipient's scoped id from `SocialMessage`. There is
   * deliberately no handle-based overload: handles are display names, they get
   * changed and reused, and sending a client's quote to whoever holds the
   * handle today is not a recoverable mistake.
   */
  sendMessage(input: {
    platform: SocialPlatform;
    accessToken: string;
    toExternalId: string;
    body: string;
  }): Promise<PublishResult>;
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

/**
 * A checkout not tied to a gig — a print order, or anything else that needs a
 * hosted payment page without the gig-shaped assumptions `requestPayment`
 * bakes in (its own success/cancel URLs, its own metadata key).
 *
 * `metadata` is echoed back verbatim on settlement. The webhook routes on it
 * rather than on the return URL, which a browser can reopen, edit, or never
 * hit at all.
 */
export interface CheckoutInput {
  referenceId: UUID;
  amountCents: Cents;
  currency: string;
  description: string;
  customerEmail: string | null;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
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
  /** Generic hosted checkout for anything that is not a gig deposit/balance. */
  createCheckout(input: CheckoutInput): Promise<PaymentRequest>;
}

// --- print labs ---------------------------------------------------------

/**
 * A product the lab can actually make, as the lab describes it.
 *
 * Deliberately not the same shape as `print_products`: the studio's catalogue
 * carries retail pricing, ordering and its own SKUs, and must survive changing
 * labs. `labSku` is the join between the two.
 */
export interface LabProduct {
  labSku: string;
  name: string;
  category: string;
  /** Trim size in millimetres, when the lab publishes one. */
  widthMm: number | null;
  heightMm: number | null;
  /** What the lab charges, minor units of `currency`. */
  costCents: Cents;
  currency: string;
  /** Minimum resolution the lab will accept, if stated. */
  minPixels: { width: number; height: number } | null;
}

export interface LabOrderItem {
  labSku: string;
  quantity: number;
  /**
   * Publicly reachable, full-resolution file. Labs fetch it themselves; none of
   * them accept a base64 payload at print sizes.
   */
  imageUrl: string;
  /** Normalised 0-1 crop rect. Omit to print the full frame. */
  crop?: { x: number; y: number; w: number; h: number };
  reference?: string;
}

export interface LabShippingAddress {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
}

export type LabOrderStatus =
  | 'received'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

export interface LabOrderResult {
  /** The lab's reference, stored on `print_orders.lab_order_ref`. */
  labOrderRef: string;
  status: LabOrderStatus;
  trackingUrl: string | null;
  /** What the lab charged, when it says so at submission time. */
  costCents: Cents | null;
}

/**
 * A print lab.
 *
 * No UK lab is wired up yet, so the mock is the only implementation and
 * `submitOrder` on a live adapter must throw `NotImplementedError` rather than
 * silently succeeding — an order that reports success without reaching a lab is
 * worse than one that fails, because nobody chases it.
 *
 * `exportOrder` is the reason this can ship before any lab integration exists:
 * it produces a spec the studio emails to a lab by hand, so prints can be sold
 * today and fulfilled automatically later without a schema change.
 */
export interface PrintLab {
  readonly provider: string;
  /** The lab's catalogue, for mapping onto `print_products.lab_sku`. */
  catalogue(): Promise<LabProduct[]>;
  /** Price a basket before charging the client. Shipping included. */
  quote(input: {
    items: readonly LabOrderItem[];
    shipTo: LabShippingAddress;
  }): Promise<{ subtotalCents: Cents; shippingCents: Cents; currency: string }>;
  submitOrder(input: {
    reference: string;
    items: readonly LabOrderItem[];
    shipTo: LabShippingAddress;
  }): Promise<LabOrderResult>;
  orderStatus(labOrderRef: string): Promise<LabOrderResult>;
  /** Manual-fulfilment fallback: a CSV spec sheet for emailing to a lab. */
  exportOrder(input: {
    reference: string;
    items: readonly LabOrderItem[];
    shipTo: LabShippingAddress;
  }): Promise<{ filename: string; contentType: string; body: string }>;
}

// --- image generation ---------------------------------------------------

export interface GeneratedImage {
  /** Raw bytes. The caller decides where to store them. */
  data: Uint8Array;
  contentType: string;
  width: number;
  height: number;
  model: string;
}

/**
 * Text-to-image, for campaign graphics.
 *
 * Only ever produces marketing artwork. Nothing from here may be written into
 * `assets` without an explicit promotion step — a generated image in a client
 * gallery or a print order is a photograph the studio did not take.
 */
export interface ImageGenerator {
  readonly provider: string;
  generate(input: {
    prompt: string;
    /** Square by default; campaigns also want 4:5 and 9:16. */
    aspectRatio?: '1:1' | '4:5' | '16:9' | '9:16';
    /** Reference image for style, where the provider supports it. */
    referenceImageUrl?: string;
    count?: number;
  }): Promise<GeneratedImage[]>;
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
  readonly printLab: PrintLab;
  readonly imageGen: ImageGenerator;
}
