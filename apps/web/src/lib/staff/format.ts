/** Display formatting for the Staff module. */

import { formatDistanceToNowStrict } from 'date-fns';

/**
 * "2 minutes ago", or an explicit "Never signed in".
 *
 * The null case is the interesting one on this page — an account that was
 * created and never used is usually a typo in the email or an invite that
 * never reached anyone, and rendering it as a dash hides that.
 */
export function signInLabel(timestamp: string | null): string {
  if (!timestamp) return 'Never signed in';
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return `${formatDistanceToNowStrict(parsed)} ago`;
}

export function addedLabel(timestamp: string | null): string {
  if (!timestamp) return 'Added at an unknown time';
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return 'Added at an unknown time';
  return `Added ${parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

/** Absolute value for a `title`, so hovering a relative time gives the real one. */
export function exactTime(timestamp: string | null): string | undefined {
  if (!timestamp) return undefined;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
