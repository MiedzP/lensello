/**
 * Gig form parsing and validation.
 *
 * Pure functions — no Supabase, no request context — so the rules are readable
 * in one place and the action stays about orchestration.
 *
 * Two of these checks mirror CHECK constraints in 20260731150000_init.sql
 * (`gigs_ends_after_starts`, `gigs_deposit_within_price`). They are duplicated
 * deliberately: Postgres rejecting a row produces "violates check constraint
 * gigs_deposit_within_price", which is not a sentence you show a photographer.
 */

import { format, isValid, parseISO } from 'date-fns';
import {
  GIG_STATUSES,
  SHOOT_TYPES,
  formatCents,
  type GigStatus,
  type ShootType,
} from '@lensello/core';

/** Raw strings straight off the form, kept so a failed submit can re-render. */
export interface GigFormValues {
  title: string;
  type: string;
  status: string;
  startsAt: string;
  endsAt: string;
  location: string;
  clientId: string;
  price: string;
  deposit: string;
  notes: string;
}

export interface ParsedGig {
  title: string;
  type: ShootType;
  status: GigStatus;
  /** ISO-8601 UTC, ready for a timestamptz column. */
  startsAt: string;
  endsAt: string;
  location: string | null;
  clientId: string | null;
  priceCents: number;
  depositCents: number;
  notes: string | null;
}

export type GigFieldErrors = Partial<Record<keyof GigFormValues, string>>;

export const EMPTY_GIG_VALUES: GigFormValues = {
  title: '',
  type: 'portrait',
  status: 'inquiry',
  startsAt: '',
  endsAt: '',
  location: '',
  clientId: '',
  price: '',
  deposit: '',
  notes: '',
};

// --- datetime ------------------------------------------------------------

/**
 * `<input type="datetime-local">` value <-> ISO timestamp.
 *
 * The input has no timezone, so both directions use the server's local zone.
 * That is correct for a single-studio product where staff and shoots share a
 * timezone; a multi-region rollout would need an explicit studio timezone.
 */
export const DATETIME_LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

export function toDateTimeLocal(iso: string): string {
  const date = parseISO(iso);
  return isValid(date) ? format(date, DATETIME_LOCAL_FORMAT) : '';
}

/** Returns null when the value is missing or not a real datetime. */
export function fromDateTimeLocal(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseISO(trimmed);
  return isValid(parsed) ? parsed : null;
}

// --- money ---------------------------------------------------------------

/**
 * Dollars-and-cents text -> integer cents, with integer arithmetic throughout.
 * `Math.round(parseFloat(x) * 100)` is the classic way to lose a cent; this
 * never builds a float from the value at all.
 */
export function parseMoneyToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,\s]/g, '');
  if (!cleaned) return 0;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;

  const [whole, fraction = ''] = cleaned.split('.');
  const cents = Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Integer cents -> the string a money `<input>` should show. */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

// --- form reading --------------------------------------------------------

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export function readGigForm(formData: FormData): GigFormValues {
  return {
    title: text(formData, 'title'),
    type: text(formData, 'type'),
    status: text(formData, 'status'),
    startsAt: text(formData, 'startsAt'),
    endsAt: text(formData, 'endsAt'),
    location: text(formData, 'location'),
    clientId: text(formData, 'clientId'),
    price: text(formData, 'price'),
    deposit: text(formData, 'deposit'),
    notes: text(formData, 'notes'),
  };
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export type GigParseResult =
  | { ok: true; gig: ParsedGig }
  | { ok: false; errors: GigFieldErrors };

export function parseGigForm(values: GigFormValues): GigParseResult {
  const errors: GigFieldErrors = {};

  const title = values.title.trim();
  if (!title) {
    errors.title = 'Give the gig a title so it is recognisable on the calendar.';
  } else if (title.length > 200) {
    errors.title = 'Keep the title under 200 characters.';
  }

  const type = values.type as ShootType;
  if (!(SHOOT_TYPES as readonly string[]).includes(values.type)) {
    errors.type = 'Choose a shoot type.';
  }

  const status = values.status as GigStatus;
  if (!(GIG_STATUSES as readonly string[]).includes(values.status)) {
    errors.status = 'Choose a status.';
  }

  const startsAt = fromDateTimeLocal(values.startsAt);
  if (!startsAt) errors.startsAt = 'Enter when the shoot starts.';

  const endsAt = fromDateTimeLocal(values.endsAt);
  if (!endsAt) errors.endsAt = 'Enter when the shoot ends.';

  // Mirrors the gigs_ends_after_starts CHECK. Note ">" not ">=": a zero-length
  // gig is rejected by Postgres too.
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    errors.endsAt = 'The end time has to be after the start time.';
  }

  const priceCents = parseMoneyToCents(values.price);
  if (priceCents === null) {
    errors.price = 'Enter the price as a number, e.g. 2500 or 2500.00.';
  }

  const depositCents = parseMoneyToCents(values.deposit);
  if (depositCents === null) {
    errors.deposit = 'Enter the deposit as a number, e.g. 500 or 500.00.';
  }

  // Mirrors the gigs_deposit_within_price CHECK.
  if (
    priceCents !== null &&
    depositCents !== null &&
    depositCents > priceCents
  ) {
    errors.deposit = `The deposit (${formatCents(depositCents)}) cannot be more than the total price (${formatCents(priceCents)}).`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    gig: {
      title,
      type,
      status,
      startsAt: startsAt!.toISOString(),
      endsAt: endsAt!.toISOString(),
      location: nullIfBlank(values.location),
      clientId: nullIfBlank(values.clientId),
      priceCents: priceCents!,
      depositCents: depositCents!,
      notes: nullIfBlank(values.notes),
    },
  };
}

// --- overlap -------------------------------------------------------------

/**
 * Half-open interval overlap: `[startsAt, endsAt)`.
 *
 * A gig that ends at exactly the moment another starts does NOT conflict —
 * back-to-back bookings are the normal case, not an error. Hence strict `<`
 * and `>` rather than `<=` / `>=`.
 */
export function intervalsOverlap(
  a: { startsAt: string | Date; endsAt: string | Date },
  b: { startsAt: string | Date; endsAt: string | Date },
): boolean {
  const aStart = new Date(a.startsAt).getTime();
  const aEnd = new Date(a.endsAt).getTime();
  const bStart = new Date(b.startsAt).getTime();
  const bEnd = new Date(b.endsAt).getTime();
  return aStart < bEnd && aEnd > bStart;
}
