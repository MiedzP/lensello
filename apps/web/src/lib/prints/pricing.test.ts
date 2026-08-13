import { describe, expect, it } from 'vitest';
import {
  MoneyError,
  computeOrderTotals,
  computeSubtotalCents,
  fallbackDomesticShippingCents,
  marginCents,
  marginPercent,
} from './pricing';

describe('computeSubtotalCents', () => {
  it('sums unit price times quantity across lines', () => {
    expect(
      computeSubtotalCents([
        { unitPrice: 900, quantity: 2 },
        { unitPrice: 2800, quantity: 1 },
      ]),
    ).toBe(900 * 2 + 2800);
  });

  it('returns zero for an empty basket', () => {
    expect(computeSubtotalCents([])).toBe(0);
  });

  it('rejects a non-integer unit price — pence do not have fractions of a penny', () => {
    expect(() => computeSubtotalCents([{ unitPrice: 9.5, quantity: 1 }])).toThrow(MoneyError);
  });

  it('rejects a negative unit price', () => {
    expect(() => computeSubtotalCents([{ unitPrice: -100, quantity: 1 }])).toThrow(MoneyError);
  });

  it('rejects a zero or negative quantity', () => {
    expect(() => computeSubtotalCents([{ unitPrice: 100, quantity: 0 }])).toThrow(MoneyError);
    expect(() => computeSubtotalCents([{ unitPrice: 100, quantity: -1 }])).toThrow(MoneyError);
  });
});

describe('marginCents / marginPercent', () => {
  it('is retail minus cost', () => {
    expect(marginCents(180, 900)).toBe(720);
  });

  it('can be negative when a product is priced under cost', () => {
    expect(marginCents(900, 500)).toBe(-400);
  });

  it('computes margin as a share of the retail price', () => {
    expect(marginPercent(180, 900)).toBeCloseTo(0.8, 5);
  });

  it('is null when the price is zero, rather than dividing by it', () => {
    expect(marginPercent(0, 0)).toBeNull();
  });
});

describe('fallbackDomesticShippingCents', () => {
  it('is free at and above the free-shipping threshold', () => {
    expect(fallbackDomesticShippingCents(15_000)).toBe(0);
    expect(fallbackDomesticShippingCents(50_000)).toBe(0);
  });

  it('is the mid-tier rate between the two thresholds', () => {
    expect(fallbackDomesticShippingCents(5_000)).toBe(495);
    expect(fallbackDomesticShippingCents(14_999)).toBe(495);
  });

  it('is the low-tier rate below the mid threshold', () => {
    expect(fallbackDomesticShippingCents(0)).toBe(395);
    expect(fallbackDomesticShippingCents(4_999)).toBe(395);
  });
});

describe('computeOrderTotals', () => {
  it('adds subtotal, shipping and tax', () => {
    expect(
      computeOrderTotals({ subtotalCents: 900, shippingCents: 395, taxCents: 0 }),
    ).toEqual({ subtotal: 900, shipping: 395, tax: 0, total: 1295 });
  });

  it('defaults tax to zero, because retail prices are already tax-inclusive', () => {
    expect(computeOrderTotals({ subtotalCents: 1000, shippingCents: 0 })).toEqual({
      subtotal: 1000,
      shipping: 0,
      tax: 0,
      total: 1000,
    });
  });

  it('rejects a negative component', () => {
    expect(() => computeOrderTotals({ subtotalCents: -1, shippingCents: 0 })).toThrow(MoneyError);
  });

  it('rejects a fractional component', () => {
    expect(() => computeOrderTotals({ subtotalCents: 100.5, shippingCents: 0 })).toThrow(MoneyError);
  });
});
