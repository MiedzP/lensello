import { describe, expect, it } from 'vitest';
import { intervalsOverlap } from './validation';

/**
 * The boundary rule is the whole point of testing this.
 *
 * Flip one comparison from `<` to `<=` and back-to-back bookings — a morning
 * ceremony followed by an afternoon portrait session — start reporting as
 * double bookings. Nothing throws; the photographer just gets told a free slot
 * is taken and turns work away. The inquiry form's availability answer rests
 * on this too.
 */
const at = (hour: number) => `2026-09-14T${String(hour).padStart(2, '0')}:00:00.000Z`;

describe('intervalsOverlap', () => {
  it('detects a straightforward overlap', () => {
    expect(
      intervalsOverlap(
        { startsAt: at(9), endsAt: at(13) },
        { startsAt: at(11), endsAt: at(15) },
      ),
    ).toBe(true);
  });

  it('treats back-to-back bookings as free, not conflicting', () => {
    expect(
      intervalsOverlap(
        { startsAt: at(9), endsAt: at(13) },
        { startsAt: at(13), endsAt: at(17) },
      ),
    ).toBe(false);
  });

  it('is symmetric — order of arguments must not change the answer', () => {
    const morning = { startsAt: at(9), endsAt: at(13) };
    const afternoon = { startsAt: at(12), endsAt: at(17) };
    expect(intervalsOverlap(morning, afternoon)).toBe(
      intervalsOverlap(afternoon, morning),
    );
  });

  it('detects full containment in both directions', () => {
    const allDay = { startsAt: at(8), endsAt: at(20) };
    const short = { startsAt: at(11), endsAt: at(12) };
    expect(intervalsOverlap(allDay, short)).toBe(true);
    expect(intervalsOverlap(short, allDay)).toBe(true);
  });

  it('reports no overlap for separated intervals', () => {
    expect(
      intervalsOverlap(
        { startsAt: at(8), endsAt: at(10) },
        { startsAt: at(14), endsAt: at(16) },
      ),
    ).toBe(false);
  });

  it('accepts Date objects and strings interchangeably', () => {
    expect(
      intervalsOverlap(
        { startsAt: new Date(at(9)), endsAt: new Date(at(13)) },
        { startsAt: at(11), endsAt: at(15) },
      ),
    ).toBe(true);
  });

  it('handles a whole-day window, which is what the inquiry form asks about', () => {
    const day = {
      startsAt: '2026-09-14T00:00:00.000Z',
      endsAt: '2026-09-14T23:59:59.999Z',
    };
    expect(intervalsOverlap(day, { startsAt: at(14), endsAt: at(18) })).toBe(true);
    expect(
      intervalsOverlap(day, {
        startsAt: '2026-09-15T09:00:00.000Z',
        endsAt: '2026-09-15T17:00:00.000Z',
      }),
    ).toBe(false);
  });
});
