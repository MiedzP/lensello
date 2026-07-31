import { z } from 'zod';
import { AD_PLATFORMS, AD_STATUSES, SHOOT_TYPES } from '@lensello/core';
import {
  AD_CALL_TO_ACTIONS,
  AD_SORT_KEYS,
  DEFAULT_SYNC_WINDOW_DAYS,
  SORT_DIRECTIONS,
  SYNC_WINDOW_DAYS,
  normalizeCallToAction,
} from './constants';

/**
 * Every untrusted boundary of the ads module in one place: URL search params,
 * submitted forms, and model output. Two of those three are obviously hostile;
 * the third — the model — is the one that gets forgotten, so its schema lives
 * right next to the other two.
 */

// --- URL search params --------------------------------------------------

const optionalParam = z
  .union([z.string(), z.array(z.string())])
  .optional()
  // A repeated param (`?status=a&status=b`) arrives as an array. Take the first
  // rather than rejecting: a filter is not worth an error page over.
  .transform((value) => (Array.isArray(value) ? value[0] : value))
  .transform((value) => (value && value.length > 0 ? value : undefined));

/**
 * `searchParams` is a Promise in Next 16 — await it, then hand the resolved
 * object here. Unknown values are dropped rather than rejected so a stale or
 * hand-edited link degrades to the unfiltered view.
 */
export const adFiltersSchema = z.object({
  status: optionalParam.pipe(z.enum(AD_STATUSES).optional().catch(undefined)),
  platform: optionalParam.pipe(z.enum(AD_PLATFORMS).optional().catch(undefined)),
  sort: optionalParam.pipe(z.enum(AD_SORT_KEYS).catch('spend')),
  dir: optionalParam.pipe(z.enum(SORT_DIRECTIONS).catch('desc')),
});

export type AdFilters = z.infer<typeof adFiltersSchema>;

export function parseAdFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AdFilters {
  const parsed = adFiltersSchema.safeParse(searchParams);
  return parsed.success
    ? parsed.data
    : { status: undefined, platform: undefined, sort: 'spend', dir: 'desc' };
}

/** True when anything is actually narrowing the list — drives which empty state to show. */
export function hasActiveFilters(filters: AdFilters): boolean {
  return Boolean(filters.status || filters.platform);
}

// --- ad create / update -------------------------------------------------

const trimmedText = z.string().transform((value) => value.trim());

const optionalText = trimmedText
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

/** `<input type="date">` posts '' when cleared, which is not a null date. */
const optionalDate = z
  .string()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: 'Dates must be a calendar date.',
  });

/** `<select>` posts '' for "none", which is a null foreign key, not a bad uuid. */
const optionalUuid = z
  .string()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine((value) => value === null || z.uuid().safeParse(value).success, {
    message: 'That selection is not a valid reference.',
  });

/**
 * Daily budget arrives as dollars because that is what a person types. Stored
 * as integer cents — `Math.round` after the multiply, since 0.1 * 100 is not
 * exactly 10 in binary floating point.
 */
const budgetDollars = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : '0'))
  // `Number('')` is 0 but `Number('abc')` is NaN, and zod's `z.number()`
  // rejects NaN — so a non-numeric budget lands on the message below rather
  // than silently becoming zero.
  .transform((value) => Number(value))
  .pipe(
    z
      .number({ error: 'Daily budget must be a number.' })
      .min(0, 'Daily budget cannot be negative.')
      .max(100_000, 'Daily budget looks like a typo — cap is $100,000/day.'),
  )
  .transform((dollars) => Math.round(dollars * 100));

export const adInputSchema = z.object({
  name: trimmedText.pipe(
    z
      .string()
      .min(1, 'Give the ad a name so you can find it later.')
      .max(120, 'Keep the name under 120 characters.'),
  ),
  platform: z.enum(AD_PLATFORMS, { error: 'Pick a platform.' }),
  headline: trimmedText.pipe(
    z.string().max(300, 'That headline is far longer than any platform allows.'),
  ),
  primaryText: trimmedText.pipe(
    z.string().max(2000, 'That primary text is far longer than any platform allows.'),
  ),
  // The persistence gate for the model's suggestion: even if the UI offered a
  // variant with an invented CTA, it cannot reach the database through here.
  callToAction: z.enum(AD_CALL_TO_ACTIONS, {
    error: 'Choose one of the supported calls to action.',
  }),
  dailyBudgetCents: budgetDollars,
  audience: optionalText,
  assetId: optionalUuid,
  campaignId: optionalUuid,
  startsOn: optionalDate,
  endsOn: optionalDate,
});

export type AdInput = z.infer<typeof adInputSchema>;

/** Reads the shared ad form's fields out of a FormData. */
export function parseAdInput(formData: FormData) {
  return adInputSchema
    .refine(
      (value) =>
        !value.startsOn || !value.endsOn || value.endsOn >= value.startsOn,
      { message: 'The end date cannot fall before the start date.', path: ['endsOn'] },
    )
    .safeParse({
      name: formData.get('name') ?? '',
      platform: formData.get('platform') ?? '',
      headline: formData.get('headline') ?? '',
      primaryText: formData.get('primaryText') ?? '',
      callToAction: formData.get('callToAction') ?? '',
      dailyBudgetCents: formData.get('dailyBudget') ?? undefined,
      audience: formData.get('audience') ?? undefined,
      assetId: formData.get('assetId') ?? undefined,
      campaignId: formData.get('campaignId') ?? undefined,
      startsOn: formData.get('startsOn') ?? undefined,
      endsOn: formData.get('endsOn') ?? undefined,
    });
}

/** First human-readable problem from a failed parse. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Something in that form did not validate.';
}

// --- status transitions -------------------------------------------------

export const AD_STATUS_INTENTS = ['launch', 'pause', 'resume', 'end'] as const;
export type AdStatusIntent = (typeof AD_STATUS_INTENTS)[number];

export const statusChangeSchema = z.object({
  adId: z.uuid('That ad reference is not valid.'),
  intent: z.enum(AD_STATUS_INTENTS, { error: 'Unknown status change.' }),
});

// --- metrics sync -------------------------------------------------------

export const syncSchema = z.object({
  /** Absent means "every launched ad" — the control on /ads. */
  adId: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null))
    .refine((value) => value === null || z.uuid().safeParse(value).success, {
      message: 'That ad reference is not valid.',
    }),
  // Only the windows the UI offers are honoured. An arbitrary `?days=9999`
  // would be a request to hammer the ad platform's reporting API.
  days: z
    .string()
    .optional()
    .transform((value) => {
      const parsed = Number(value);
      return (SYNC_WINDOW_DAYS as readonly number[]).includes(parsed)
        ? parsed
        : DEFAULT_SYNC_WINDOW_DAYS;
    }),
});

// --- AI copy generation -------------------------------------------------

export const generateCopySchema = z.object({
  shootType: z.enum(SHOOT_TYPES, {
    error: 'Pick the kind of shoot this ad is selling.',
  }),
  audience: optionalText,
  offer: optionalText,
  variantCount: z.number().int().min(2).max(6).catch(4),
});

export type GenerateCopyInput = z.infer<typeof generateCopySchema>;

/**
 * The model's response shape.
 *
 * Deliberately permissive on `callToAction`: it stays a plain string here so an
 * off-list answer does not throw away three perfectly good variants. It is
 * normalised against the allowed set afterwards, and a variant whose CTA cannot
 * be matched is surfaced as such rather than silently coerced. `adInputSchema`
 * is still the gate that decides what may be written.
 */
export const adCopyResponseSchema = z.object({
  variants: z
    .array(
      z.object({
        angle: z.string().transform((value) => value.trim()),
        headline: z.string().transform((value) => value.trim()),
        primaryText: z.string().transform((value) => value.trim()),
        callToAction: z.string().transform((value) => value.trim()),
      }),
    )
    .min(1, 'The model returned no variants.'),
});

/** A generated variant, annotated with everything the UI needs to be honest about it. */
export interface CopyVariant {
  angle: string;
  headline: string;
  primaryText: string;
  /** Canonical CTA, or null when the model answered off-list. */
  callToAction: string | null;
  /** What the model actually said, kept so the UI can show the rejected value. */
  rawCallToAction: string;
}

/** Parses and annotates model output. Drops variants with no usable copy at all. */
export function toCopyVariants(raw: unknown): CopyVariant[] {
  const parsed = adCopyResponseSchema.parse(raw);

  return parsed.variants
    .filter(
      (variant) => variant.headline.length > 0 && variant.primaryText.length > 0,
    )
    .map((variant) => ({
      angle: variant.angle || 'Untitled angle',
      headline: variant.headline,
      primaryText: variant.primaryText,
      callToAction: normalizeCallToAction(variant.callToAction),
      rawCallToAction: variant.callToAction,
    }));
}
