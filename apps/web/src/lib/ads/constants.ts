import type { Tone } from '@/components/ui';
import type { AdPlatform, AdStatus } from '@lensello/core';

/**
 * Ads module vocabulary.
 *
 * `AD_PLATFORMS` and `AD_STATUSES` come from `@lensello/core` because they
 * cross module boundaries (the dashboard counts active ads). Everything here is
 * ads-only, so it stays local.
 */

/**
 * The call-to-action set. This list is the *same* one `buildAdCopyPrompt`
 * writes into its system prompt — the prompt asks the model to choose from it,
 * and this array is what we check the answer against before persisting. If the
 * two ever drift, the model's choices start getting rejected, which is the
 * failure mode we want rather than storing a CTA no platform accepts.
 */
export const AD_CALL_TO_ACTIONS = [
  'Book now',
  'Learn more',
  'Get quote',
  'See portfolio',
  'Check availability',
] as const;
export type AdCallToAction = (typeof AD_CALL_TO_ACTIONS)[number];

export function isAdCallToAction(value: string): value is AdCallToAction {
  return (AD_CALL_TO_ACTIONS as readonly string[]).includes(value);
}

/**
 * Case-insensitive match against the allowed set, returning the canonical
 * casing. Model output is untrusted, but "book now" is a casing slip rather
 * than a made-up CTA, and rejecting it would throw away usable copy.
 */
export function normalizeCallToAction(value: string): AdCallToAction | null {
  const needle = value.trim().toLowerCase();
  return (
    AD_CALL_TO_ACTIONS.find((cta) => cta.toLowerCase() === needle) ?? null
  );
}

/**
 * Creative length budgets, mirroring the constraints in `buildAdCopyPrompt`.
 * Used to warn on overshoot — never to truncate. Silently cutting a headline
 * hides the fact that the generated copy did not fit.
 */
export const HEADLINE_MAX_CHARS = 40;
export const PRIMARY_TEXT_MAX_CHARS = 125;

export const AD_STATUS_LABELS: Record<AdStatus, string> = {
  draft: 'Draft',
  review: 'In review',
  active: 'Active',
  paused: 'Paused',
  ended: 'Ended',
};

export const AD_STATUS_TONES: Record<AdStatus, Tone> = {
  draft: 'neutral',
  review: 'accent',
  active: 'success',
  paused: 'warning',
  ended: 'neutral',
};

export const AD_PLATFORM_LABELS: Record<AdPlatform, string> = {
  meta: 'Meta',
  google: 'Google',
  tiktok: 'TikTok',
};

/** Sortable columns on /ads. Both are rolled-up values, so sorting happens in
 *  application code after `summarize()` rather than in SQL. */
export const AD_SORT_KEYS = ['spend', 'leads'] as const;
export type AdSortKey = (typeof AD_SORT_KEYS)[number];

export const AD_SORT_LABELS: Record<AdSortKey, string> = {
  spend: 'Spend',
  leads: 'Leads',
};

export const SORT_DIRECTIONS = ['desc', 'asc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/** Windows offered by the "Sync performance" control. */
export const SYNC_WINDOW_DAYS = [7, 30, 90] as const;
export type SyncWindowDays = (typeof SYNC_WINDOW_DAYS)[number];
export const DEFAULT_SYNC_WINDOW_DAYS: SyncWindowDays = 30;

/**
 * Signed-URL lifetimes for the private `photos` bucket.
 *
 * Short for previews the user is looking at right now; longer for the URL
 * handed to an ad platform, which has to be able to fetch the creative after
 * the request that created it has ended.
 */
export const PREVIEW_URL_TTL_SECONDS = 60 * 60; // 1 hour
export const CREATIVE_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** Cap on how many library photos the creative picker offers at once. */
export const CREATIVE_PICKER_LIMIT = 48;
