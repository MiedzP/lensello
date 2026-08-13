import { describe, expect, it } from 'vitest';
import { formatMinorUnits, parseMinorUnitsInput } from './money';

describe('formatMinorUnits', () => {
  it('formats a whole amount without decimals', () => {
    expect(formatMinorUnits(900, 'GBP')).toBe('£9');
  });

  it('keeps decimals when there are pence', () => {
    expect(formatMinorUnits(925, 'GBP')).toBe('£9.25');
  });

  it('uses the currency passed in, not a hardcoded symbol', () => {
    expect(formatMinorUnits(1000, 'USD')).toContain('$');
    expect(formatMinorUnits(1000, 'EUR')).toContain('€');
  });
});

describe('parseMinorUnitsInput', () => {
  it('parses a whole number of pounds', () => {
    expect(parseMinorUnitsInput('9')).toBe(900);
  });

  it('parses two decimal places exactly, without float drift', () => {
    // 9.00 * 100 as a naive float op can land on 899.9999999999999 for some
    // inputs; the string-based parse must not reproduce that.
    expect(parseMinorUnitsInput('9.00')).toBe(900);
    expect(parseMinorUnitsInput('12.50')).toBe(1250);
    expect(parseMinorUnitsInput('0.01')).toBe(1);
    expect(parseMinorUnitsInput('325.00')).toBe(32500);
  });

  it('pads a single decimal place', () => {
    expect(parseMinorUnitsInput('9.5')).toBe(950);
  });

  it('rejects more than two decimal places', () => {
    expect(parseMinorUnitsInput('9.999')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(parseMinorUnitsInput('nine pounds')).toBeNull();
    expect(parseMinorUnitsInput('-9')).toBeNull();
  });

  it('rejects blank input', () => {
    expect(parseMinorUnitsInput('')).toBeNull();
    expect(parseMinorUnitsInput('   ')).toBeNull();
  });
});
