import { describe, expect, it } from 'vitest';
import {
  calendarHref,
  nextWeek,
  parseCalendarView,
  parseReferenceDate,
  previousWeek,
  referenceDateParam,
  weekDays,
  weekRange,
} from './calendar-grid';

describe('parseCalendarView', () => {
  it('defaults to month', () => {
    expect(parseCalendarView(undefined)).toBe('month');
    expect(parseCalendarView('bogus')).toBe('month');
  });

  it('accepts week', () => {
    expect(parseCalendarView('week')).toBe('week');
  });
});

describe('parseReferenceDate', () => {
  const today = new Date(2026, 8, 14); // local-time reference, not UTC-anchored

  it('falls back to today when missing or malformed', () => {
    expect(parseReferenceDate(undefined, today)).toBe(today);
    expect(parseReferenceDate('not-a-date', today)).toBe(today);
    expect(parseReferenceDate('2026-13-40', today)).toBe(today);
  });

  it('parses a valid date param', () => {
    const parsed = parseReferenceDate('2026-09-01', today);
    expect(referenceDateParam(parsed)).toBe('2026-09-01');
  });
});

describe('weekDays / weekRange', () => {
  it('returns seven consecutive days starting on Monday', () => {
    // 2026-09-16 is a Wednesday.
    const days = weekDays(new Date(2026, 8, 16));
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.getDay())).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(referenceDateParam(days[0]!)).toBe('2026-09-14'); // Monday
    expect(referenceDateParam(days[6]!)).toBe('2026-09-20'); // Sunday
  });

  it('a Sunday belongs to the week that just ended, not the next one', () => {
    // 2026-09-20 is a Sunday.
    const days = weekDays(new Date(2026, 8, 20));
    expect(referenceDateParam(days[0]!)).toBe('2026-09-14');
    expect(referenceDateParam(days[6]!)).toBe('2026-09-20');
  });

  it('weekRange agrees with weekDays at the boundaries', () => {
    const reference = new Date(2026, 8, 16);
    const { start, end } = weekRange(reference);
    const days = weekDays(reference);
    expect(referenceDateParam(start)).toBe(referenceDateParam(days[0]!));
    expect(referenceDateParam(end)).toBe(referenceDateParam(days[6]!));
  });
});

describe('previousWeek / nextWeek', () => {
  it('moves by exactly seven days', () => {
    const reference = new Date(2026, 8, 16);
    expect(referenceDateParam(nextWeek(reference))).toBe('2026-09-23');
    expect(referenceDateParam(previousWeek(reference))).toBe('2026-09-09');
  });

  it('crosses a month boundary', () => {
    const reference = new Date(2026, 8, 28);
    expect(referenceDateParam(nextWeek(reference))).toBe('2026-10-05');
  });

  it('crosses a year boundary', () => {
    const reference = new Date(2026, 11, 29);
    expect(referenceDateParam(nextWeek(reference))).toBe('2027-01-05');
  });

  it('previousWeek and nextWeek are inverses', () => {
    const reference = new Date(2026, 8, 16);
    expect(referenceDateParam(previousWeek(nextWeek(reference)))).toBe(
      referenceDateParam(reference),
    );
  });
});

describe('calendarHref', () => {
  it('builds a bare path with no params', () => {
    expect(calendarHref({})).toBe('/calendar');
  });

  it('carries view, date and campaign together', () => {
    const href = calendarHref({
      view: 'week',
      date: '2026-09-16',
      campaignId: 'abc-123',
    });
    expect(href).toBe('/calendar?view=week&date=2026-09-16&campaign=abc-123');
  });

  it('accepts a Date object for the date param', () => {
    const href = calendarHref({ date: new Date(2026, 8, 16) });
    expect(href).toBe('/calendar?date=2026-09-16');
  });
});
