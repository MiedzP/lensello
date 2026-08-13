/**
 * Formatting money for the print store.
 *
 * `print_products` and `print_orders` each carry their own `currency` column
 * rather than always trusting the studio-wide default — a studio that changes
 * its configured currency must not silently relabel money a client already
 * agreed to pay in a different one. This wraps the same `Intl.NumberFormat`
 * approach as `@lensello/core`'s `formatCents`, but takes the currency
 * explicitly instead of reading it from the environment, so a display never
 * hardcodes "£" and never assumes the order's currency matches the studio's
 * current default.
 */

import { currencyLocale } from '@lensello/core';

export function formatMinorUnits(amount: number, currency: string): string {
  return new Intl.NumberFormat(currencyLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}

/**
 * Parses a staff-typed price like "9" or "12.50" into integer minor units,
 * without ever passing through a float. `parseFloat('9.00') * 100` is not
 * guaranteed to land on exactly `900` — string arithmetic on the two parts is.
 * Returns null for anything that is not plain digits with at most two decimal
 * places, rather than guessing at what the staff member meant.
 */
export function parseMinorUnitsInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;

  const whole = match[1]!;
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return Number(whole) * 100 + Number(fraction);
}
