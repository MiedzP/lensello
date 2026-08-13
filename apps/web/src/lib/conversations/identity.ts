/**
 * Identifier normalisation for `contact_identities`.
 *
 * `contact_identities.identifier` is stored normalised — addresses lowercased,
 * phones stripped to digits and a leading `+`, handles without a leading `@` —
 * and there is a unique index on `(channel, identifier)`
 * (20260813120300_conversations.sql). That index only does its job if every
 * write and every lookup runs the value through the same normalisation; two
 * different-looking strings that mean the same address, number or handle must
 * come out identical here or the index lets a duplicate through.
 *
 * `whatsapp` is deliberately normalised as a phone number, not a handle:
 * WhatsApp addresses by number. The schema still gives it its own channel,
 * separate from `phone`, because a studio's SMS number and WhatsApp number are
 * not always the same one.
 */

import type { Tables } from '@/lib/db.types';

export type ContactChannel = Tables<'contact_identities'>['channel'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Real phone numbers run longer than this once punctuation is stripped. */
const MIN_PHONE_DIGITS = 6;
/** Longer than any real handle on the platforms this schema supports. */
const MAX_HANDLE_LENGTH = 100;

function normalizeEmail(raw: string): string | null {
  const value = raw.toLowerCase();
  return EMAIL_PATTERN.test(value) ? value : null;
}

/**
 * Digits and a single leading `+`, matching the `regexp_replace(phone,
 * '[^0-9+]', '', 'g')` the migration's own backfill uses — a UI-side value that
 * normalised any differently would silently stop matching what the database
 * already holds.
 */
function normalizePhone(raw: string): string | null {
  const stripped = raw.replace(/[^0-9+]/g, '');
  const leadingPlus = stripped.startsWith('+') ? '+' : '';
  const digits = stripped.replace(/\+/g, '');
  if (digits.length < MIN_PHONE_DIGITS) return null;
  return `${leadingPlus}${digits}`;
}

/** Trimmed, lower-cased, and without the leading `@` platforms display but do not store. */
function normalizeHandle(raw: string): string | null {
  const value = raw.trim().replace(/^@+/, '').trim().toLowerCase();
  if (!value) return null;
  if (value.length > MAX_HANDLE_LENGTH) return null;
  return value;
}

/**
 * Normalises a raw, staff-typed value for the given channel.
 *
 * Returns `null` for anything not shaped like a usable identifier on that
 * channel — callers should treat that as a validation failure, not as "no
 * identifier", so a typo is rejected rather than silently stored.
 */
export function normalizeContactIdentifier(
  channel: ContactChannel,
  raw: string | null | undefined,
): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  switch (channel) {
    case 'email':
      return normalizeEmail(trimmed);
    case 'phone':
    case 'whatsapp':
      return normalizePhone(trimmed);
    case 'instagram':
    case 'facebook':
    case 'tiktok':
    case 'pinterest':
      return normalizeHandle(trimmed);
    default:
      return null;
  }
}
