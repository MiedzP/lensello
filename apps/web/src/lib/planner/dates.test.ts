import { describe, expect, it } from 'vitest';
import {
  addDaysUTC,
  formatDateOnly,
  isPostingDay,
  layOutTaskDate,
  nextPostingDayOnOrAfter,
  offsetDate,
  parseDateOnly,
  sanitizePostingDays,
  weekdayOf,
} from './dates';

describe('parseDateOnly / formatDateOnly', () => {
  it('round-trips a date without shifting it', () => {
    expect(formatDateOnly(parseDateOnly('2026-09-14'))).toBe('2026-09-14');
  });

  it('rejects malformed input', () => {
    expect(() => parseDateOnly('14/09/2026')).toThrow();
    expect(() => parseDateOnly('2026-9-14')).toThrow();
  });

  it('rejects dates that do not exist', () => {
    // Date.UTC(2026, 1, 30) silently rolls forward into March; catch it.
    expect(() => parseDateOnly('2026-02-30')).toThrow();
  });

  it('never drifts a day under a negative UTC offset', () => {
    // The regression this whole module exists to prevent: if any step used
    // `new Date('2026-09-14')` and then a *local* getter/setter, a viewer in
    // a negative-offset timezone (anywhere in the Americas) could see the
    // date roll back to the 13th. Every accessor here is UTC-anchored, so
    // this must hold regardless of the machine's configured timezone.
    const date = parseDateOnly('2026-09-14');
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(8); // 0-indexed: September
    expect(date.getUTCDate()).toBe(14);
  });
});

describe('addDaysUTC', () => {
  it('adds days forward', () => {
    expect(formatDateOnly(addDaysUTC(parseDateOnly('2026-09-14'), 3))).toBe(
      '2026-09-17',
    );
  });

  it('subtracts days for a negative offset', () => {
    expect(formatDateOnly(addDaysUTC(parseDateOnly('2026-09-14'), -21))).toBe(
      '2026-08-24',
    );
  });

  it('crosses a month boundary correctly', () => {
    expect(formatDateOnly(addDaysUTC(parseDateOnly('2026-09-28'), 5))).toBe(
      '2026-10-03',
    );
  });

  it('crosses a year boundary correctly', () => {
    expect(formatDateOnly(addDaysUTC(parseDateOnly('2026-12-30'), 5))).toBe(
      '2027-01-04',
    );
  });
});

describe('weekdayOf', () => {
  it('matches the 0=Sunday..6=Saturday convention used by posting_days', () => {
    // 2026-09-14 is a Monday.
    expect(weekdayOf(parseDateOnly('2026-09-14'))).toBe(1);
    // 2026-09-13 is a Sunday.
    expect(weekdayOf(parseDateOnly('2026-09-13'))).toBe(0);
    // 2026-09-19 is a Saturday.
    expect(weekdayOf(parseDateOnly('2026-09-19'))).toBe(6);
  });
});

describe('offsetDate', () => {
  it('applies a positive offset from the campaign start', () => {
    expect(offsetDate('2026-09-01', 13)).toBe('2026-09-14');
  });

  it('applies a negative offset for the run-up', () => {
    // "Book your stand three weeks before the fair."
    expect(offsetDate('2026-09-14', -21)).toBe('2026-08-24');
  });

  it('a zero offset returns the start date itself', () => {
    expect(offsetDate('2026-09-14', 0)).toBe('2026-09-14');
  });
});

describe('nextPostingDayOnOrAfter', () => {
  const MON_WED_FRI = [1, 3, 5];

  it('leaves a date unchanged when it already falls on a posting day', () => {
    // 2026-09-14 is a Monday, which is in Mon/Wed/Fri.
    expect(nextPostingDayOnOrAfter('2026-09-14', MON_WED_FRI)).toBe('2026-09-14');
  });

  it('moves a Tuesday forward to Wednesday', () => {
    expect(nextPostingDayOnOrAfter('2026-09-15', MON_WED_FRI)).toBe('2026-09-16');
  });

  it('moves a Saturday forward into the following week\'s Monday', () => {
    // 2026-09-19 is a Saturday; the next Mon/Wed/Fri day is Monday 2026-09-21.
    expect(nextPostingDayOnOrAfter('2026-09-19', MON_WED_FRI)).toBe('2026-09-21');
  });

  it('supports a single posting day', () => {
    expect(nextPostingDayOnOrAfter('2026-09-14', [3])).toBe('2026-09-16');
  });

  it('returns the date unchanged when postingDays is empty', () => {
    expect(nextPostingDayOnOrAfter('2026-09-15', [])).toBe('2026-09-15');
  });

  it('handles a posting day that wraps across a month boundary', () => {
    // 2026-09-30 is a Wednesday; with only Sunday posting, the next hit is
    // 2026-10-04.
    expect(nextPostingDayOnOrAfter('2026-09-30', [0])).toBe('2026-10-04');
  });
});

describe('layOutTaskDate', () => {
  const MON_WED_FRI = [1, 3, 5];

  it('snaps a post-kind task onto the next posting day', () => {
    // starts 2026-09-01 (Tuesday) + offset 0 = Tuesday 2026-09-01, which is
    // not a posting day; the post should land on Wednesday 2026-09-02.
    const result = layOutTaskDate(
      '2026-09-01',
      { day_offset: 0, kind: 'post' },
      MON_WED_FRI,
    );
    expect(result).toEqual({ dueOn: '2026-09-02', snapped: true });
  });

  it('snaps a story-kind task the same way as a post', () => {
    const result = layOutTaskDate(
      '2026-09-01',
      { day_offset: 0, kind: 'story' },
      MON_WED_FRI,
    );
    expect(result.dueOn).toBe('2026-09-02');
  });

  it('does not snap admin, outreach, call, email, ad, shoot or print tasks', () => {
    for (const kind of ['admin', 'outreach', 'call', 'email', 'ad', 'shoot', 'print']) {
      const result = layOutTaskDate('2026-09-01', { day_offset: 0, kind }, MON_WED_FRI);
      expect(result).toEqual({ dueOn: '2026-09-01', snapped: false });
    }
  });

  it('reports snapped: false when the offset date already lands on a posting day', () => {
    // 2026-09-01 is a Tuesday; offset +1 = Wednesday, a posting day.
    const result = layOutTaskDate(
      '2026-09-01',
      { day_offset: 1, kind: 'post' },
      MON_WED_FRI,
    );
    expect(result).toEqual({ dueOn: '2026-09-02', snapped: false });
  });

  it('lays out a realistic wedding-fair run-up correctly', () => {
    // Fair day itself, offset 0 from a start date equal to the fair.
    const bookStand = layOutTaskDate(
      '2026-09-19',
      { day_offset: -21, kind: 'admin' },
      MON_WED_FRI,
    );
    expect(bookStand.dueOn).toBe('2026-08-29');

    // A follow-up post the Monday after the fair should land on the next
    // Mon/Wed/Fri on or after that offset date.
    const followUpPost = layOutTaskDate(
      '2026-09-19',
      { day_offset: 2, kind: 'post' },
      MON_WED_FRI,
    );
    // offset date is 2026-09-21 (Monday), already a posting day.
    expect(followUpPost).toEqual({ dueOn: '2026-09-21', snapped: false });
  });
});

describe('isPostingDay', () => {
  it('checks membership', () => {
    expect(isPostingDay(1, [1, 3, 5])).toBe(true);
    expect(isPostingDay(2, [1, 3, 5])).toBe(false);
  });
});

describe('sanitizePostingDays', () => {
  it('drops out-of-range and non-integer values', () => {
    expect(sanitizePostingDays([1, 3, 5, 7, -1, 2.5])).toEqual([1, 3, 5]);
  });

  it('de-duplicates and sorts', () => {
    expect(sanitizePostingDays([5, 1, 1, 3, 5])).toEqual([1, 3, 5]);
  });

  it('returns an empty array for an empty input', () => {
    expect(sanitizePostingDays([])).toEqual([]);
  });
});
