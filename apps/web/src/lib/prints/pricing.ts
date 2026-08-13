/**
 * Money maths for the print store.
 *
 * Every amount here is an integer number of minor units (pence). Nothing in
 * this file divides, multiplies by a fraction, or rounds a float into being —
 * a VAT calculation or a per-unit price that briefly exists as a float is how
 * a studio ends up a penny off on an invoice, and pennies are exactly what
 * clients notice.
 */

export class MoneyError extends Error {}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new MoneyError(`${label} must be a non-negative integer number of minor units, got ${value}.`);
  }
}

export interface OrderLine {
  unitPrice: number;
  quantity: number;
}

/** Sum of `unitPrice * quantity` across every line. Never derives a unit price itself — that is snapshotted onto the line at the moment it was added to the basket, not recomputed here. */
export function computeSubtotalCents(lines: readonly OrderLine[]): number {
  return lines.reduce((total, line) => {
    assertNonNegativeInteger(line.unitPrice, 'unitPrice');
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new MoneyError(`quantity must be a positive integer, got ${line.quantity}.`);
    }
    return total + line.unitPrice * line.quantity;
  }, 0);
}

/** What the studio pockets on a single unit: retail minus what the lab charges. Can be negative — that is a fact worth surfacing, not hiding. */
export function marginCents(unitCost: number, price: number): number {
  assertNonNegativeInteger(unitCost, 'unitCost');
  assertNonNegativeInteger(price, 'price');
  return price - unitCost;
}

/** Margin as a share of the retail price. Null when the price is zero — dividing by it would be "how many times does nothing go into something", which is not a percentage. */
export function marginPercent(unitCost: number, price: number): number | null {
  if (price === 0) return null;
  return marginCents(unitCost, price) / price;
}

/**
 * Flat-rate UK shipping bands, used only as a fallback when the lab's own
 * `quote()` cannot be reached — a print order must never stall on a network
 * blip when there is a documented, if approximate, standing rate to fall back
 * on. Mirrors the mock lab's own bands (see `mockShippingCents` in
 * packages/core/src/integrations/mock.ts) so a demo run and a fallback run
 * agree with each other. When the lab is reachable, `quote()` — not this — is
 * the number that gets charged.
 */
export const FREE_SHIPPING_THRESHOLD_CENTS = 15_000;
export const MID_TIER_THRESHOLD_CENTS = 5_000;
export const MID_TIER_SHIPPING_CENTS = 495;
export const LOW_TIER_SHIPPING_CENTS = 395;

export function fallbackDomesticShippingCents(subtotalCents: number): number {
  assertNonNegativeInteger(subtotalCents, 'subtotalCents');
  if (subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS) return 0;
  if (subtotalCents >= MID_TIER_THRESHOLD_CENTS) return MID_TIER_SHIPPING_CENTS;
  return LOW_TIER_SHIPPING_CENTS;
}

export interface OrderTotals {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
}

/**
 * Combines the three components a `print_orders` row stores into the total
 * that gets charged. Every `print_products.price` is tax-inclusive (see the
 * migration), so `tax` defaults to zero rather than this function inventing a
 * VAT rate the schema does not carry; pass a non-zero value explicitly if a
 * future breakdown needs one.
 */
export function computeOrderTotals(input: {
  subtotalCents: number;
  shippingCents: number;
  taxCents?: number;
}): OrderTotals {
  assertNonNegativeInteger(input.subtotalCents, 'subtotalCents');
  assertNonNegativeInteger(input.shippingCents, 'shippingCents');
  const tax = input.taxCents ?? 0;
  assertNonNegativeInteger(tax, 'taxCents');

  return {
    subtotal: input.subtotalCents,
    shipping: input.shippingCents,
    tax,
    total: input.subtotalCents + input.shippingCents + tax,
  };
}
