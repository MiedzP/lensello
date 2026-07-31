/** Display formatting for the Clients module. No domain logic — see stages.ts. */

import { formatDistanceToNowStrict } from 'date-fns';

/** "3 hours ago" / "2 days ago". Falls back gracefully on a bad timestamp. */
export function age(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return 'unknown';
  return `${formatDistanceToNowStrict(parsed)} ago`;
}

/** Absolute date for a `title`/tooltip, so hovering gives the real value. */
export function fullDateTime(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  return parsed.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * A `YYYY-MM-DD` calendar date, rendered in UTC.
 *
 * Pinning the timezone matters: `new Date('2026-09-14')` is parsed as UTC
 * midnight, and formatting that in a timezone behind UTC prints the 13th.
 */
export function formatDateOnly(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function shortDate(timestamp: string | null): string {
  if (!timestamp) return '—';
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * First line or so of a message body, collapsed to one line.
 *
 * Email bodies arrive with hard wrapping and signature blocks; showing the raw
 * prefix in a list row produces ragged rows, so whitespace is collapsed first.
 */
export function snippet(body: string, maxLength = 140): string {
  const collapsed = body.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) return collapsed;
  const cut = collapsed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Fallback display name when a provider gives us an address and nothing else. */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  const words = local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(' ') || email;
}
