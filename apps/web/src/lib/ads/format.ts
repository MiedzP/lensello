import { formatCents, type AdPerformance, type Cents, type DateOnly } from '@lensello/core';

/**
 * Presentation helpers for ad numbers.
 *
 * The rule running through all of these: a value that does not exist renders as
 * an em dash, never as a zero. "$0 cost per lead" and "0.00% CTR on zero
 * impressions" both read as facts about the ad's performance when they are
 * actually facts about the absence of data — that is how a dashboard ends up
 * actively misleading someone into pausing a working ad.
 */

/** What we render wherever a number is genuinely unknown. */
export const NO_VALUE = '—';

const COUNT_FORMAT = new Intl.NumberFormat('en-US');

export function formatCount(value: number): string {
  return COUNT_FORMAT.format(value);
}

/**
 * CTR as a percentage.
 *
 * Undefined when nothing was served: `summarize()` reports `ctr: 0` for zero
 * impressions because a fraction needs a number, but 0% is not the truth, so
 * the caller passes impressions and gets a dash instead.
 */
export function formatCtr(ctr: number, impressions: number): string {
  if (impressions === 0) return NO_VALUE;

  const percent = ctr * 100;
  // Ad CTRs live around 1-3%: two decimals there, but a coarser figure once
  // the number is large enough that the hundredths are noise.
  const digits = percent >= 10 ? 1 : 2;
  return `${percent.toFixed(digits)}%`;
}

/** Cost per lead. Null — no leads yet — is a dash, never `$0`. */
export function formatCostPerLead(costPerLeadCents: Cents | null): string {
  return costPerLeadCents === null ? NO_VALUE : formatCents(costPerLeadCents);
}

/** Money that is a real total, so zero spend legitimately shows as $0. */
export function formatSpend(spendCents: Cents): string {
  return formatCents(spendCents);
}

/**
 * `YYYY-MM-DD` as a short human date.
 *
 * Parsed as UTC deliberately. `new Date('2026-03-01')` is midnight UTC, and
 * formatting that in a negative-offset timezone renders "Feb 28" — a daily
 * metrics table that shows every day one off.
 */
export function formatDay(day: DateOnly): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Longer form, for headers where the year matters. */
export function formatDayLong(day: DateOnly): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** The scheduled flight of an ad, either endpoint optionally open. */
export function formatDateWindow(
  startsOn: DateOnly | null,
  endsOn: DateOnly | null,
): string {
  if (!startsOn && !endsOn) return 'No dates set';
  if (startsOn && !endsOn) return `From ${formatDayLong(startsOn)}`;
  if (!startsOn && endsOn) return `Until ${formatDayLong(endsOn)}`;
  return `${formatDayLong(startsOn!)} – ${formatDayLong(endsOn!)}`;
}

/** Cents as a plain decimal for a number input's value. */
export function centsToBudgetInput(cents: Cents): string {
  return (cents / 100).toFixed(2);
}

/**
 * A one-line spoken summary of a performance roll-up, for the chart's
 * `aria-label` — an SVG on its own conveys nothing to a screen reader.
 */
export function describePerformance(performance: AdPerformance): string {
  const parts = [
    `${formatCount(performance.impressions)} impressions`,
    `${formatCount(performance.clicks)} clicks`,
    `${formatCtr(performance.ctr, performance.impressions)} click-through rate`,
    `${formatSpend(performance.spendCents)} spent`,
    `${formatCount(performance.leads)} leads`,
  ];

  parts.push(
    performance.costPerLeadCents === null
      ? 'no cost per lead yet'
      : `${formatCents(performance.costPerLeadCents)} per lead`,
  );

  return parts.join(', ');
}
