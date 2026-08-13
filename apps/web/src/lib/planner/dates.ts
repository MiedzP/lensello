/**
 * Date-laying-out logic: playbook day offsets -> real `due_on` dates, with
 * post-like tasks snapped onto the campaign's posting days.
 *
 * Every function here works on `YYYY-MM-DD` strings using UTC-anchored
 * arithmetic only (`Date.UTC`, `getUTCDay`, `setUTCDate`). That is
 * deliberate: `campaigns.starts_on` and `campaign_tasks.due_on` are Postgres
 * `date` columns with no time component, and the moment this logic reaches
 * for a local-timezone method (`getDay`, `new Date('2026-09-14')` interpreted
 * locally, `setDate`) a task computed as "the Monday before the fair" can
 * render as Sunday for anyone west of UTC. Doing every step in UTC, and only
 * ever formatting back out as a bare date, keeps the calendar day the same
 * no matter what timezone the server or the browser is in.
 */

import { isPostLikeKind, type TaskKind } from './types';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` -> a UTC-midnight `Date`. Throws on anything else. */
export function parseDateOnly(value: string): Date {
  if (!DATE_ONLY.test(value)) {
    throw new Error(`Not a YYYY-MM-DD date: "${value}"`);
  }
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Catches "2026-02-30": Date.UTC silently rolls it into March.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Not a real calendar date: "${value}"`);
  }
  return date;
}

/** UTC-midnight `Date` -> `YYYY-MM-DD`. */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Adds (or subtracts, for negative `days`) whole days without drift. */
export function addDaysUTC(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/** 0 = Sunday … 6 = Saturday, matching `posting_days`. */
export function weekdayOf(date: Date): number {
  return date.getUTCDay();
}

/** `startsOn` (`YYYY-MM-DD`) shifted by `dayOffset` whole days. */
export function offsetDate(startsOn: string, dayOffset: number): string {
  return formatDateOnly(addDaysUTC(parseDateOnly(startsOn), dayOffset));
}

/**
 * The next date on or after `date` whose weekday is in `postingDays`.
 *
 * Walks forward at most a week — `postingDays` is a subset of 0-6, so a
 * match always exists within seven days unless the array is empty, in which
 * case the date is returned unchanged rather than snapping to nothing.
 */
export function nextPostingDayOnOrAfter(
  date: string,
  postingDays: readonly number[],
): string {
  if (postingDays.length === 0) return date;
  const allowed = new Set(postingDays);

  let cursor = parseDateOnly(date);
  for (let step = 0; step < 7; step += 1) {
    if (allowed.has(weekdayOf(cursor))) return formatDateOnly(cursor);
    cursor = addDaysUTC(cursor, 1);
  }
  // Unreachable when postingDays only contains valid 0-6 values.
  return date;
}

export interface LaidOutTask {
  dueOn: string;
  /** True when the date was moved forward to land on a posting day. */
  snapped: boolean;
}

/**
 * Where one playbook task lands on the calendar.
 *
 * Post-like tasks (`post`, `story`) are the direct answer to "if the
 * campaign posts Mon/Wed/Fri, generated post tasks land on those days": the
 * offset gives the earliest sensible date, then the date is pushed forward
 * to the next day the campaign actually posts on. Every other kind — book a
 * stand, follow up a lead, print the flyers — happens on a real-world day
 * that has nothing to do with the posting schedule, so its offset date is
 * used as-is.
 */
export function layOutTaskDate(
  startsOn: string,
  task: { day_offset: number; kind: TaskKind | string },
  postingDays: readonly number[],
): LaidOutTask {
  const base = offsetDate(startsOn, task.day_offset);
  if (!isPostLikeKind(task.kind)) return { dueOn: base, snapped: false };

  const dueOn = nextPostingDayOnOrAfter(base, postingDays);
  return { dueOn, snapped: dueOn !== base };
}

/** Is `dayOfWeek` (0-6) a day this campaign posts on? Guards a malformed array. */
export function isPostingDay(dayOfWeek: number, postingDays: readonly number[]): boolean {
  return postingDays.includes(dayOfWeek);
}

/** Clamps and de-duplicates a posting-days array to valid 0-6 weekday values. */
export function sanitizePostingDays(values: readonly number[]): number[] {
  const valid = new Set<number>();
  for (const value of values) {
    if (Number.isInteger(value) && value >= 0 && value <= 6) valid.add(value);
  }
  return [...valid].sort((a, b) => a - b);
}
