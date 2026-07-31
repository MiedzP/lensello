/**
 * Date/time presentation for gigs, and the URL grammar of `/gigs`.
 *
 * All date maths goes through date-fns; nothing here does arithmetic on
 * milliseconds or reimplements "what month is this".
 */

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isValid,
  parse,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { GIG_STATUSES, type GigStatus } from '@lensello/core';

/** The calendar week starts on Monday: a weekend shoot should not be split. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export const MONTH_PARAM_FORMAT = 'yyyy-MM';

export type GigsView = 'calendar' | 'list';

/** searchParams values arrive as `string | string[] | undefined`. */
export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseView(value: string | string[] | undefined): GigsView {
  return firstParam(value) === 'list' ? 'list' : 'calendar';
}

/** `?status=` is either a real gig status or absent, meaning "all". */
export function parseStatusFilter(
  value: string | string[] | undefined,
): GigStatus | null {
  const raw = firstParam(value);
  return raw && (GIG_STATUSES as readonly string[]).includes(raw)
    ? (raw as GigStatus)
    : null;
}

/** `?month=YYYY-MM` -> the first instant of that month. Falls back to today. */
export function parseMonthParam(
  value: string | string[] | undefined,
  today = new Date(),
): Date {
  const raw = firstParam(value);
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return startOfMonth(today);

  const parsed = parse(raw, MONTH_PARAM_FORMAT, today);
  return isValid(parsed) ? startOfMonth(parsed) : startOfMonth(today);
}

export function toMonthParam(date: Date): string {
  return format(date, MONTH_PARAM_FORMAT);
}

export function previousMonth(month: Date): Date {
  return subMonths(month, 1);
}

export function nextMonth(month: Date): Date {
  return addMonths(month, 1);
}

/**
 * Build a `/gigs` URL, carrying the params the user did not change so switching
 * view keeps the month and the status filter.
 */
export function gigsHref(params: {
  view?: GigsView;
  month?: Date | string | null;
  status?: GigStatus | null;
}): `/gigs` | `/gigs?${string}` {
  const search = new URLSearchParams();
  if (params.view) search.set('view', params.view);

  if (params.month) {
    search.set(
      'month',
      typeof params.month === 'string' ? params.month : toMonthParam(params.month),
    );
  }

  if (params.status) search.set('status', params.status);

  const query = search.toString();
  return query ? `/gigs?${query}` : '/gigs';
}

// --- month grid ----------------------------------------------------------

export interface CalendarWeek {
  /** Seven days, Monday to Sunday. */
  days: Date[];
}

/**
 * The visible grid for a month: whole weeks, so leading and trailing days from
 * the neighbouring months fill the first and last rows.
 */
export function monthGrid(month: Date): CalendarWeek[] {
  const gridStart = startOfWeek(startOfMonth(month), WEEK_OPTIONS);
  const gridEnd = endOfWeek(endOfMonth(month), WEEK_OPTIONS);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weeks: CalendarWeek[] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push({ days: days.slice(index, index + 7) });
  }
  return weeks;
}

export function weekdayHeadings(): { short: string; long: string }[] {
  const reference = startOfWeek(new Date(), WEEK_OPTIONS);
  return eachDayOfInterval({
    start: reference,
    end: endOfWeek(reference, WEEK_OPTIONS),
  }).map((day) => ({ short: format(day, 'EEEEE'), long: format(day, 'EEEE') }));
}

export function monthRangeIso(month: Date): { fromIso: string; toIso: string } {
  // Query the whole visible grid, not just the month, so a gig on a trailing
  // day of the previous month still renders in the first row.
  return {
    fromIso: startOfWeek(startOfMonth(month), WEEK_OPTIONS).toISOString(),
    toIso: endOfWeek(endOfMonth(month), WEEK_OPTIONS).toISOString(),
  };
}

// --- labels --------------------------------------------------------------

export function monthLabel(month: Date): string {
  return format(month, 'MMMM yyyy');
}

export function dayNumber(day: Date): string {
  return format(day, 'd');
}

export const DATE_PARAM_FORMAT = 'yyyy-MM-dd';

/** `YYYY-MM-DD` for `/gigs/new?date=`. */
export function dateParam(day: Date): string {
  return format(day, DATE_PARAM_FORMAT);
}

/** `?date=YYYY-MM-DD` -> midnight on that day, or null if unusable. */
export function parseDateParam(
  value: string | string[] | undefined,
  today = new Date(),
): Date | null {
  const raw = firstParam(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = parse(raw, DATE_PARAM_FORMAT, today);
  return isValid(parsed) ? parsed : null;
}

/** 24-hour start time for the dense calendar chips. */
export function shortTimeLabel(iso: string): string {
  const date = parseISO(iso);
  return isValid(date) ? format(date, 'HH:mm') : '—';
}

export function dayLabel(day: Date): string {
  return format(day, 'EEEE d MMMM yyyy');
}

export function timeLabel(iso: string): string {
  const date = parseISO(iso);
  return isValid(date) ? format(date, 'h:mm a') : '—';
}

/** "Sat 14 Sep 2026 · 2:00 PM – 10:00 PM", collapsing same-day ranges. */
export function whenLabel(startsAtIso: string, endsAtIso: string): string {
  const start = parseISO(startsAtIso);
  const end = parseISO(endsAtIso);
  if (!isValid(start) || !isValid(end)) return '—';

  if (isSameDay(start, end)) {
    return `${format(start, 'EEE d MMM yyyy')} · ${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`;
  }
  return `${format(start, 'EEE d MMM yyyy, h:mm a')} → ${format(end, 'EEE d MMM yyyy, h:mm a')}`;
}

/** Does a gig's interval touch this calendar day? Half-open, as everywhere. */
export function gigTouchesDay(
  gig: { starts_at: string; ends_at: string },
  day: Date,
): boolean {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const startsAt = parseISO(gig.starts_at).getTime();
  const endsAt = parseISO(gig.ends_at).getTime();
  return startsAt < dayEnd.getTime() && endsAt > dayStart.getTime();
}
