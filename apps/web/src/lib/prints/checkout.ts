/**
 * Turning a basket into a charge.
 *
 * Nothing here trusts a total the client sent — there is no such input. Every
 * number is derived from `print_order_items` rows already snapshotted at
 * add-to-basket time, plus a live shipping quote from the lab adapter. That is
 * the whole of the "never trust a price from the client" rule in one place:
 * the client picks *what*, the server decides *how much*.
 */

import { getIntegrations, IntegrationError } from '@lensello/core/integrations';
import type { LabOrderItem, LabShippingAddress } from '@lensello/core/integrations';
import type { createAdminClient } from '@/lib/supabase/admin';
import { computeOrderTotals, computeSubtotalCents, fallbackDomesticShippingCents } from './pricing';
import type { CartItemRow, CartOrderRow } from './cart';
import { recordOrderEvent } from './cart';

type Admin = ReturnType<typeof createAdminClient>;

export class CheckoutError extends Error {}

const PREVIEW_URL_TTL_SECONDS = 60 * 60 * 24; // A day is generous for a lab to fetch a file once.

async function signedPreviewUrl(admin: Admin, storagePath: string): Promise<string | null> {
  const { data } = await admin.storage.from('photos').createSignedUrl(storagePath, PREVIEW_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

interface QuoteResult {
  subtotalCents: number;
  shippingCents: number;
  physicalItemCount: number;
}

/**
 * Prices a basket: retail subtotal from the snapshotted line prices, shipping
 * from the lab (or a documented flat-rate fallback for a UK address when the
 * lab cannot be reached — see `fallbackDomesticShippingCents`).
 */
export async function quoteCart(
  admin: Admin,
  items: readonly CartItemRow[],
  shipTo: LabShippingAddress,
): Promise<QuoteResult> {
  if (items.length === 0) {
    throw new CheckoutError('The basket is empty.');
  }

  const subtotalCents = computeSubtotalCents(
    items.map((item) => ({ unitPrice: item.unit_price, quantity: item.quantity })),
  );

  const productIds = [...new Set(items.map((item) => item.product_id))];
  const { data: products, error } = await admin
    .from('print_products')
    .select('id, is_digital, lab_sku')
    .in('id', productIds);
  if (error) throw new CheckoutError(`Could not price the basket: ${error.message}.`);

  const productById = new Map((products ?? []).map((product) => [product.id, product]));

  const physicalItems = items.filter((item) => !productById.get(item.product_id)?.is_digital);

  if (physicalItems.length === 0) {
    return { subtotalCents, shippingCents: 0, physicalItemCount: 0 };
  }

  const unmapped = physicalItems.find((item) => !productById.get(item.product_id)?.lab_sku);
  if (unmapped) {
    throw new CheckoutError(
      'One of the items in your basket needs a little more setup before checkout. Please contact the studio and they will sort it out.',
    );
  }

  const labItems: LabOrderItem[] = await Promise.all(
    physicalItems.map(async (item) => ({
      labSku: productById.get(item.product_id)!.lab_sku!,
      quantity: item.quantity,
      imageUrl: (await signedPreviewUrl(admin, await assetStoragePath(admin, item.asset_id))) ?? '',
      crop: item.crop as LabOrderItem['crop'],
    })),
  );

  const { printLab } = getIntegrations();

  try {
    const quote = await printLab.quote({ items: labItems, shipTo });
    return { subtotalCents, shippingCents: quote.shippingCents, physicalItemCount: physicalItems.length };
  } catch (cause) {
    if (shipTo.country === 'GB') {
      // The lab is unreachable but a UK flat rate is a documented fallback —
      // failing the checkout entirely over a transient lab outage would be
      // worse than charging the standing rate.
      console.error('[checkout] lab quote failed, using the UK flat-rate fallback', cause);
      return {
        subtotalCents,
        shippingCents: fallbackDomesticShippingCents(subtotalCents),
        physicalItemCount: physicalItems.length,
      };
    }
    throw new CheckoutError(
      cause instanceof IntegrationError
        ? `Could not get an international shipping quote: ${cause.message}`
        : 'Could not get a shipping quote for that address. Please contact the studio.',
    );
  }
}

async function assetStoragePath(admin: Admin, assetId: string): Promise<string> {
  const { data } = await admin.from('assets').select('storage_path').eq('id', assetId).maybeSingle();
  if (!data) throw new CheckoutError('One of the photographs in your basket could not be found.');
  return data.storage_path;
}

export interface StartCheckoutResult {
  checkoutUrl: string;
}

/**
 * Prices the basket, opens a Stripe checkout session for the total, and
 * records the order as awaiting payment. The webhook — not this function, and
 * not the browser returning to a success URL — is what marks it paid.
 */
export async function startCheckout(
  admin: Admin,
  order: CartOrderRow,
  items: readonly CartItemRow[],
  input: { returnBaseUrl: string; galleryToken: string },
): Promise<StartCheckoutResult> {
  if (order.status !== 'cart') {
    throw new CheckoutError('This basket has already been checked out.');
  }
  if (!order.contact_email || !order.ship_line1 || !order.ship_city || !order.ship_postcode) {
    throw new CheckoutError('Add your contact and delivery details before checking out.');
  }

  const shipTo: LabShippingAddress = {
    name: order.contact_name ?? '',
    line1: order.ship_line1,
    line2: order.ship_line2,
    city: order.ship_city,
    postcode: order.ship_postcode,
    country: order.ship_country,
  };

  const quote = await quoteCart(admin, items, shipTo);
  const totals = computeOrderTotals({
    subtotalCents: quote.subtotalCents,
    shippingCents: quote.shippingCents,
  });

  const { payments } = getIntegrations();
  const request = await payments.createCheckout({
    referenceId: order.id,
    amountCents: totals.total,
    currency: order.currency,
    description: 'Print order',
    customerEmail: order.contact_email,
    successUrl: `${input.returnBaseUrl}/g/${input.galleryToken}/shop/paid?order=${order.id}`,
    cancelUrl: `${input.returnBaseUrl}/g/${input.galleryToken}/shop?cancelled=1`,
    metadata: { printOrderId: order.id },
  });

  const { error } = await admin
    .from('print_orders')
    .update({
      status: 'awaiting_payment',
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      tax: totals.tax,
      total: totals.total,
      stripe_payment_intent_id: request.externalId,
    })
    .eq('id', order.id)
    .eq('status', 'cart'); // Guarded: a double-click must not open two sessions for one basket.

  if (error) {
    throw new CheckoutError(`Could not start checkout: ${error.message}.`);
  }

  await recordOrderEvent(admin, order.id, 'checkout_started', request.externalId, totals);

  return { checkoutUrl: request.url };
}
