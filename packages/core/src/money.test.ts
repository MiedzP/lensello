import { afterEach, describe, expect, it } from 'vitest';
import { currencyCode, formatCents } from './types';

/**
 * This was hardcoded to USD for a studio operating in the UK. On a dashboard
 * that is ugly; on a contract it is the figure a client agrees to, so it is
 * the difference between an agreement and a dispute.
 */
describe('formatCents', () => {
  const original = process.env.NEXT_PUBLIC_LENSELLO_CURRENCY;
  const originalLocale = process.env.NEXT_PUBLIC_LENSELLO_LOCALE;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_LENSELLO_CURRENCY;
    else process.env.NEXT_PUBLIC_LENSELLO_CURRENCY = original;
    if (originalLocale === undefined) delete process.env.NEXT_PUBLIC_LENSELLO_LOCALE;
    else process.env.NEXT_PUBLIC_LENSELLO_LOCALE = originalLocale;
  });

  it('defaults to pounds', () => {
    delete process.env.NEXT_PUBLIC_LENSELLO_CURRENCY;
    delete process.env.NEXT_PUBLIC_LENSELLO_LOCALE;
    expect(currencyCode()).toBe('GBP');
    expect(formatCents(250_000)).toContain('£');
  });

  it('drops the decimals on a round figure', () => {
    // "£2,500" reads like a price; "£2,500.00" reads like an invoice line.
    delete process.env.NEXT_PUBLIC_LENSELLO_CURRENCY;
    expect(formatCents(250_000)).toBe('£2,500');
  });

  it('keeps the decimals when there are pence', () => {
    delete process.env.NEXT_PUBLIC_LENSELLO_CURRENCY;
    expect(formatCents(250_050)).toBe('£2,500.50');
  });

  it('formats zero without falling back to a blank', () => {
    delete process.env.NEXT_PUBLIC_LENSELLO_CURRENCY;
    expect(formatCents(0)).toBe('£0');
  });

  it('honours a configured currency', () => {
    process.env.NEXT_PUBLIC_LENSELLO_CURRENCY = 'USD';
    process.env.NEXT_PUBLIC_LENSELLO_LOCALE = 'en-US';
    expect(currencyCode()).toBe('USD');
    expect(formatCents(250_000)).toBe('$2,500');
  });

  it('upper-cases a lower-case currency code rather than throwing', () => {
    // Intl rejects an unknown code outright, and a typo in an env var should
    // not take out every page that shows a price.
    process.env.NEXT_PUBLIC_LENSELLO_CURRENCY = 'eur';
    expect(currencyCode()).toBe('EUR');
    expect(() => formatCents(1000)).not.toThrow();
  });
});
