/**
 * Presentation helpers for the campaigns module.
 *
 * Pure functions and lookup tables only — this module is imported by both
 * Server and Client Components, so it must not touch the database, the
 * filesystem, or `process.env`.
 */

import type { CampaignStatus, PostStatus, SocialPlatform } from '@lensello/core';
import type { Tone } from '@/components/ui';

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  scheduled: 'Scheduled',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  failed: 'Failed',
};

export const CAMPAIGN_STATUS_TONES: Record<CampaignStatus, Tone> = {
  draft: 'neutral',
  ready: 'accent',
  scheduled: 'warning',
  active: 'success',
  completed: 'neutral',
  archived: 'neutral',
};

export const POST_STATUS_TONES: Record<PostStatus, Tone> = {
  draft: 'neutral',
  approved: 'accent',
  scheduled: 'warning',
  published: 'success',
  failed: 'danger',
};

/** "Mar 3 – Mar 21", "From Mar 3", "Until Mar 21", or "No dates set". */
export function formatDateWindow(
  startsOn: string | null,
  endsOn: string | null,
): string {
  const start = startsOn ? formatDateOnly(startsOn) : null;
  const end = endsOn ? formatDateOnly(endsOn) : null;

  if (start && end) return `${start} – ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return 'No dates set';
}

/**
 * Formats a `YYYY-MM-DD` column. Parsed as UTC on purpose: `new Date('2026-03-03')`
 * is midnight UTC, and rendering it in a negative-offset locale would show the
 * 2nd.
 */
export function formatDateOnly(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Formats a timestamptz for display. */
export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * `timestamptz` -> the `YYYY-MM-DDTHH:mm` a `datetime-local` input wants, in the
 * viewer's own offset. Returns '' for null so the input stays empty.
 */
export function toDateTimeLocalValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Renders hashtags for editing: one space-separated line of `#tag` tokens. */
export function formatHashtags(hashtags: readonly string[]): string {
  return hashtags.map((tag) => `#${tag}`).join(' ');
}
