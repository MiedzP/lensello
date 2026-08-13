/**
 * Presentation helpers for playbooks and the checklist.
 *
 * Pure functions and lookup tables only, imported from both Server and Client
 * Components — no database, filesystem, or `process.env` access here.
 */

import type { Tone } from '@/components/ui';
import { PLAYBOOK_SEASONS, TASK_KINDS, type PlaybookSeason, type TaskKind } from './types';

export const SEASON_LABELS: Record<PlaybookSeason, string> = {
  wedding_fair: 'Wedding fair season',
  engagement: 'Engagement season',
  new_year: "New Year",
  valentines: "Valentine's Day",
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  christmas: 'Christmas',
  evergreen: 'Evergreen',
  other: 'Other',
};

/** Grouping order for the playbook dropdown: the calendar year, then the rest. */
export const SEASON_ORDER: readonly PlaybookSeason[] = [
  'new_year',
  'valentines',
  'engagement',
  'spring',
  'summer',
  'wedding_fair',
  'autumn',
  'christmas',
  'evergreen',
  'other',
];

export function sortSeasons(seasons: readonly PlaybookSeason[]): PlaybookSeason[] {
  const rank = new Map(SEASON_ORDER.map((season, index) => [season, index]));
  return [...seasons].sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99));
}

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  post: 'Post',
  story: 'Story',
  email: 'Email',
  outreach: 'Outreach',
  ad: 'Ad',
  call: 'Call',
  shoot: 'Shoot',
  admin: 'Admin',
  print: 'Print',
};

/** Tone reused from the shared `Badge` vocabulary — no bespoke colours. */
export const TASK_KIND_TONES: Record<TaskKind, Tone> = {
  post: 'accent',
  story: 'accent',
  email: 'neutral',
  outreach: 'warning',
  ad: 'warning',
  call: 'neutral',
  shoot: 'success',
  admin: 'neutral',
  print: 'neutral',
};

export function isTaskKind(value: string): value is TaskKind {
  return (TASK_KINDS as readonly string[]).includes(value);
}

export function isPlaybookSeason(value: string): value is PlaybookSeason {
  return (PLAYBOOK_SEASONS as readonly string[]).includes(value);
}

/** Weekday checkboxes for the posting-day control. Monday-first, like the calendar. */
export const WEEKDAY_OPTIONS: readonly { value: number; short: string; long: string }[] = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
];

/** "Mon, Wed, Fri" for a `posting_days` array, in calendar order. */
export function formatPostingDays(days: readonly number[]): string {
  if (days.length === 0) return 'No posting days set';
  const set = new Set(days);
  return WEEKDAY_OPTIONS.filter((day) => set.has(day.value))
    .map((day) => day.short)
    .join(', ');
}

/** `HH:mm:ss` (Postgres `time`) -> `HH:mm` for a `<input type="time">`. */
export function toTimeInputValue(value: string): string {
  return value.slice(0, 5);
}

/** A checklist row's status, for its badge tone and grouping in the UI. */
export type TaskStatus = 'done' | 'overdue' | 'today' | 'upcoming' | 'unscheduled';

export function taskStatus(
  task: { due_on: string | null; done_at: string | null },
  todayIso: string,
): TaskStatus {
  if (task.done_at) return 'done';
  if (!task.due_on) return 'unscheduled';
  if (task.due_on < todayIso) return 'overdue';
  if (task.due_on === todayIso) return 'today';
  return 'upcoming';
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  done: 'Done',
  overdue: 'Overdue',
  today: 'Due today',
  upcoming: 'Upcoming',
  unscheduled: 'No date',
};

export const TASK_STATUS_TONES: Record<TaskStatus, Tone> = {
  done: 'success',
  overdue: 'danger',
  today: 'warning',
  upcoming: 'neutral',
  unscheduled: 'neutral',
};
