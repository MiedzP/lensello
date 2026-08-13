import type { Tone } from '@/components/ui';

/**
 * Studio vocabulary and guard rails.
 *
 * Imported by both Server and Client Components, so this file stays free of
 * server-only imports (no `cookies()`, no Supabase server client) — same rule
 * as `lib/library/constants.ts`.
 */

// --- label vocabulary, mirrors the CHECK on asset_ai_labels.kind ---------

export const LABEL_KINDS = [
  'subject',
  'scene',
  'moment',
  'emotion',
  'object',
  'colour',
  'people',
] as const;
export type LabelKind = (typeof LABEL_KINDS)[number];

export function isLabelKind(value: unknown): value is LabelKind {
  return typeof value === 'string' && (LABEL_KINDS as readonly string[]).includes(value);
}

export type LabelSource = 'ai' | 'manual';

// --- studio_requests.status, mirrors the CHECK -----------------------------

export const STUDIO_REQUEST_STATUSES = [
  'drafting',
  'searching',
  'ready',
  'approved',
  'rejected',
  'failed',
] as const;
export type StudioRequestStatus = (typeof STUDIO_REQUEST_STATUSES)[number];

export const STUDIO_REQUEST_STATUS_LABELS: Record<StudioRequestStatus, string> = {
  drafting: 'Drafting',
  searching: 'Searching',
  ready: 'Ready to review',
  approved: 'Pushed to a campaign',
  rejected: 'Rejected',
  failed: 'Failed',
};

export const STUDIO_REQUEST_STATUS_TONES: Record<StudioRequestStatus, Tone> = {
  drafting: 'neutral',
  searching: 'warning',
  ready: 'accent',
  approved: 'success',
  rejected: 'neutral',
  failed: 'danger',
};

// --- decision vocabulary, shared by studio_shortlist and generated_images --

export type Decision = 'pending' | 'approved' | 'rejected';

export const DECISION_LABELS: Record<Decision, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const DECISION_TONES: Record<Decision, Tone> = {
  pending: 'neutral',
  approved: 'success',
  rejected: 'danger',
};

// --- brief interpretation defaults ----------------------------------------

/** "10 photos of the groom's speech" — the number the client actually asked for. */
export const DEFAULT_SHORTLIST_SIZE = 10;
export const MIN_SHORTLIST_SIZE = 1;
export const MAX_SHORTLIST_SIZE = 40;

export function clampShortlistSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SHORTLIST_SIZE;
  return Math.min(MAX_SHORTLIST_SIZE, Math.max(MIN_SHORTLIST_SIZE, Math.round(value)));
}

/** How many un-captioned assets one click of "Caption more" processes. */
export const CAPTION_BATCH_SIZE = 20;

/** A sentinel tag stamped onto every asset promoted from `generated_images`. */
export const GENERATED_TAG = 'ai-generated';

// --- misc guards -----------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
