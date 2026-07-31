/**
 * Shared domain types for Lensello.
 *
 * These are the vocabulary that crosses module boundaries. Anything only one
 * module cares about belongs in that module, not here. Enum-like values are
 * declared as `const` arrays so they can drive both Postgres check constraints
 * and UI <Select> options from one source.
 */

// --- primitives ---------------------------------------------------------

/** Money is always integer cents. Never store currency as a float. */
export type Cents = number;

/** ISO-8601 timestamp string, as returned by Postgres via Supabase. */
export type Timestamp = string;

/** ISO-8601 calendar date, `YYYY-MM-DD`. */
export type DateOnly = string;

export type UUID = string;

// --- shared vocabulary --------------------------------------------------

export const SHOOT_TYPES = [
  'wedding',
  'engagement',
  'portrait',
  'headshot',
  'family',
  'event',
  'commercial',
  'product',
  'real_estate',
] as const;
export type ShootType = (typeof SHOOT_TYPES)[number];

export const SOCIAL_PLATFORMS = [
  'instagram',
  'facebook',
  'tiktok',
  'pinterest',
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const AD_PLATFORMS = ['meta', 'google', 'tiktok'] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

export const SHOOT_TYPE_LABELS: Record<ShootType, string> = {
  wedding: 'Wedding',
  engagement: 'Engagement',
  portrait: 'Portrait',
  headshot: 'Headshot',
  family: 'Family',
  event: 'Event',
  commercial: 'Commercial',
  product: 'Product',
  real_estate: 'Real estate',
};

// --- library ------------------------------------------------------------

export const SHOOT_STATUSES = [
  'planned',
  'shot',
  'culling',
  'editing',
  'delivered',
  'archived',
] as const;
export type ShootStatus = (typeof SHOOT_STATUSES)[number];

export interface Shoot {
  id: UUID;
  title: string;
  type: ShootType;
  status: ShootStatus;
  clientId: UUID | null;
  gigId: UUID | null;
  /** When the shoot happened. Null for a planned shoot with no date yet. */
  shotAt: Timestamp | null;
  location: string | null;
  notes: string | null;
  coverAssetId: UUID | null;
  assetCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Asset {
  id: UUID;
  shootId: UUID;
  /** Path within the `photos` storage bucket. Not a public URL. */
  storagePath: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  /** 0 = unrated, 1-5 stars. Mirrors how photographers cull. */
  rating: number;
  /** Marked as a portfolio/delivery select. */
  isSelect: boolean;
  tags: string[];
  /** AI-generated description, used as grounding for caption generation. */
  altText: string | null;
  capturedAt: Timestamp | null;
  createdAt: Timestamp;
}

// --- campaigns ----------------------------------------------------------

export const CAMPAIGN_OBJECTIVES = [
  'book_more_shoots',
  'fill_a_date',
  'promote_a_package',
  'showcase_portfolio',
  'seasonal_promo',
  'referral_push',
] as const;
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const CAMPAIGN_OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  book_more_shoots: 'Book more shoots',
  fill_a_date: 'Fill an open date',
  promote_a_package: 'Promote a package',
  showcase_portfolio: 'Showcase portfolio',
  seasonal_promo: 'Seasonal promotion',
  referral_push: 'Referral push',
};

export const CAMPAIGN_STATUSES = [
  'draft',
  'ready',
  'scheduled',
  'active',
  'completed',
  'archived',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface Campaign {
  id: UUID;
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  /** Free-text intent the photographer typed; the AI grounding prompt. */
  brief: string | null;
  /** Who this is aimed at, e.g. "engaged couples in Boston, 25-34". */
  audience: string | null;
  platforms: SocialPlatform[];
  startsOn: DateOnly | null;
  endsOn: DateOnly | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const POST_STATUSES = [
  'draft',
  'approved',
  'scheduled',
  'published',
  'failed',
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export interface CampaignPost {
  id: UUID;
  campaignId: UUID;
  platform: SocialPlatform;
  caption: string;
  hashtags: string[];
  /** Ordered — index 0 is the carousel cover. */
  assetIds: UUID[];
  status: PostStatus;
  scheduledFor: Timestamp | null;
  publishedAt: Timestamp | null;
  /** Platform post id, once published through an integration adapter. */
  externalId: string | null;
  failureReason: string | null;
  createdAt: Timestamp;
}

// --- clients ------------------------------------------------------------

export const CLIENT_STAGES = [
  'lead',
  'inquiry',
  'quoted',
  'booked',
  'completed',
  'lost',
] as const;
export type ClientStage = (typeof CLIENT_STAGES)[number];

export const CLIENT_STAGE_LABELS: Record<ClientStage, string> = {
  lead: 'Lead',
  inquiry: 'Inquiry',
  quoted: 'Quoted',
  booked: 'Booked',
  completed: 'Completed',
  lost: 'Lost',
};

export const CLIENT_SOURCES = [
  'instagram',
  'referral',
  'website',
  'google',
  'wedding_wire',
  'repeat',
  'other',
] as const;
export type ClientSource = (typeof CLIENT_SOURCES)[number];

export interface Client {
  id: UUID;
  name: string;
  email: string | null;
  phone: string | null;
  stage: ClientStage;
  source: ClientSource;
  notes: string | null;
  /** Denormalised for list views; recomputed on message insert. */
  lastContactedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type MessageDirection = 'inbound' | 'outbound';

export interface Message {
  id: UUID;
  clientId: UUID;
  direction: MessageDirection;
  subject: string | null;
  body: string;
  /** False for inbound messages that still need a reply. */
  isHandled: boolean;
  /** Set when the body was AI-drafted and not yet edited by a human. */
  isAiDraft: boolean;
  sentAt: Timestamp;
  /** Provider message id from the Gmail adapter. */
  externalId: string | null;
  createdAt: Timestamp;
}

// --- gigs ---------------------------------------------------------------

export const GIG_STATUSES = [
  'inquiry',
  'hold',
  'confirmed',
  'completed',
  'cancelled',
] as const;
export type GigStatus = (typeof GIG_STATUSES)[number];

export const GIG_STATUS_LABELS: Record<GigStatus, string> = {
  inquiry: 'Inquiry',
  hold: 'Tentative hold',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export interface Gig {
  id: UUID;
  clientId: UUID | null;
  shootId: UUID | null;
  title: string;
  type: ShootType;
  status: GigStatus;
  startsAt: Timestamp;
  endsAt: Timestamp;
  location: string | null;
  /** Total quoted price. */
  priceCents: Cents;
  depositCents: Cents;
  depositPaidAt: Timestamp | null;
  balancePaidAt: Timestamp | null;
  notes: string | null;
  /** Shot list, call times, gear reminders — ordered checklist. */
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GigTask {
  id: UUID;
  gigId: UUID;
  label: string;
  isDone: boolean;
  dueAt: Timestamp | null;
  position: number;
}

// --- ads ----------------------------------------------------------------

export const AD_STATUSES = [
  'draft',
  'review',
  'active',
  'paused',
  'ended',
] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

export interface Ad {
  id: UUID;
  /** Optional link back to the marketing campaign this supports. */
  campaignId: UUID | null;
  platform: AdPlatform;
  name: string;
  status: AdStatus;
  headline: string;
  primaryText: string;
  callToAction: string;
  /** Creative image, drawn from the photo library. */
  assetId: UUID | null;
  dailyBudgetCents: Cents;
  audience: string | null;
  /** Ad id in the external platform, once launched via an adapter. */
  externalId: string | null;
  startsOn: DateOnly | null;
  endsOn: DateOnly | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** One row per ad per day. */
export interface AdMetric {
  id: UUID;
  adId: UUID;
  day: DateOnly;
  impressions: number;
  clicks: number;
  spendCents: Cents;
  /** Inquiries attributed to this ad. */
  leads: number;
}

export interface AdPerformance {
  adId: UUID;
  impressions: number;
  clicks: number;
  spendCents: Cents;
  leads: number;
  /** Click-through rate as a fraction, e.g. 0.021 for 2.1%. */
  ctr: number;
  /** Cost per lead in cents. Null when there are no leads yet. */
  costPerLeadCents: Cents | null;
}

// --- helpers ------------------------------------------------------------

export function formatCents(cents: Cents): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function summarize(metrics: readonly AdMetric[], adId: UUID): AdPerformance {
  const rows = metrics.filter((m) => m.adId === adId);
  const impressions = rows.reduce((n, m) => n + m.impressions, 0);
  const clicks = rows.reduce((n, m) => n + m.clicks, 0);
  const spendCents = rows.reduce((n, m) => n + m.spendCents, 0);
  const leads = rows.reduce((n, m) => n + m.leads, 0);

  return {
    adId,
    impressions,
    clicks,
    spendCents,
    leads,
    ctr: impressions === 0 ? 0 : clicks / impressions,
    costPerLeadCents: leads === 0 ? null : Math.round(spendCents / leads),
  };
}
