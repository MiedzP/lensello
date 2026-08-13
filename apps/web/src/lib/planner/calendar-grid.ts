/**
 * The calendar page's own date/view maths: which mode is showing (month or
 * week), which day is the reference, and the URL grammar for moving between
 * them.
 *
 * Deliberately separate from `./dates` (which lays out playbook offsets) and
 * `./calendar` (which loads the rows to draw) — this file only ever answers
 * "what does the grid look like", and every function in it is pure so the
 * calendar's navigation can be unit tested the same way its date-laying-out
 * logic is.
 */

import {
  addDays,
  addWeeks,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfWeek,
  subWeeks,
} from 'date-fns';

/** Monday-first, matching the gigs calendar's convention. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export const REFERENCE_DATE_FORMAT = 'yyyy-MM-dd';

export type CalendarViewMode = 'month' | 'week';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCalendarView(value: string | string[] | undefined): CalendarViewMode {
  return firstParam(value) === 'week' ? 'week' : 'month';
}

/** `?date=YYYY-MM-DD` -> that day, or today if missing/unusable. */
export function parseReferenceDate(
  value: string | string[] | undefined,
  today = new Date(),
): Date {
  const raw = firstParam(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return today;
  const parsed = parse(raw, REFERENCE_DATE_FORMAT, today);
  return isValid(parsed) ? parsed : today;
}

export function referenceDateParam(date: Date): string {
  return format(date, REFERENCE_DATE_FORMAT);
}

/** The seven days (Monday-Sunday) of the week containing `referenceDate`. */
export function weekDays(referenceDate: Date): Date[] {
  const start = startOfWeek(referenceDate, WEEK_OPTIONS);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function weekRange(referenceDate: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(referenceDate, WEEK_OPTIONS),
    end: endOfWeek(referenceDate, WEEK_OPTIONS),
  };
}

export function previousWeek(referenceDate: Date): Date {
  return subWeeks(referenceDate, 1);
}

export function nextWeek(referenceDate: Date): Date {
  return addWeeks(referenceDate, 1);
}

/**
 * Builds a `/calendar` URL, carrying whatever the caller does not pass so
 * switching one control (say, the campaign filter) does not reset the others.
 */
export function calendarHref(params: {
  view?: CalendarViewMode;
  date?: Date | string;
  campaignId?: string | null;
}): `/calendar` | `/calendar?${string}` {
  const search = new URLSearchParams();
  if (params.view) search.set('view', params.view);
  if (params.date) {
    search.set(
      'date',
      typeof params.date === 'string' ? params.date : referenceDateParam(params.date),
    );
  }
  if (params.campaignId) search.set('campaign', params.campaignId);

  const query = search.toString();
  return query ? `/calendar?${query}` : '/calendar';
}
