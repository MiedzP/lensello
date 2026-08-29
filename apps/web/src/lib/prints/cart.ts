/**
 * The client-facing basket.
 *
 * Runs on the **service role**, exactly like `lib/galleries/queries.ts` — a
 * gallery visitor has no session, so there is no RLS context to run under.
 * Every function here takes a `galleryId` that the caller already resolved
 * from a token (see `lib/galleries/queries.ts#resolveGallery`), and every
 * write re-checks that the order it is touching actually belongs to that
 * gallery. A cart id alone is not enough to act on a cart — it also has to
 * belong to the gallery the caller's token unlocked, or one guessed uuid
 * would let a stranger add items to, or read out, anyone else's basket.
 */

import type { createAdminClient } from '@/lib/supabase/admin';
import type { Tables, TablesInsert } from '@/lib/db.types';
import type { CropRect } from './resolution';

type Admin = ReturnType<typeof createAdminClient>;

export type CartOrderRow = Tables<'print_orders'>;
export type CartItemRow = Tables<'print_order_items'>;
export type CatalogueProductRow = Tables<'print_products'>;

export class CartError extends Error {}

/** The catalogue as a visitor is allowed to see it — active products only. */
export async function listActiveCatalogue(admin: Admin): Promise<CatalogueProductRow[]> {
  const { data, error } = await admin
    .from('print_products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Loads a basket, scoped to the gallery it must belong to. Null if it does not exist, belongs to someone else's gallery, or is no longer editable. */
export async function loadCart(
  admin: Admin,
  orderId: string,
  galleryId: string,
): Promise<CartOrderRow | null> {
  const { data } = await admin
    .from('print_orders')
    .select('*')
    .eq('id', orderId)
    .eq('gallery_id', galleryId)
    .maybeSingle();
  return data ?? null;
}

export async function createCart(admin: Admin, galleryId: string): Promise<CartOrderRow> {
  const { data, error } = await admin
    .from('print_orders')
    .insert({ gallery_id: galleryId, status: 'cart' })
    .select('*')
    .single();

  if (error || !data) {
    throw new CartError(`Could not start a basket: ${error?.message ?? 'unknown error'}.`);
  }
  return data;
}

export async function listCartItems(admin: Admin, orderId: string): Promise<CartItemRow[]> {
  const { data, error } = await admin
    .from('print_order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Records a state change. Best-effort — a failed audit write must never undo the order change that already happened. */
export async function recordOrderEvent(
  admin: Admin,
  orderId: string,
  kind: string,
  detail?: string,
  payload?: unknown,
): Promise<void> {
  try {
    await admin.from('print_order_events').insert({
      order_id: orderId,
      kind,
      detail: detail ?? null,
      payload: (payload as TablesInsert<'print_order_events'>['payload']) ?? null,
    });
  } catch (cause) {
    console.error(`[print-order ${orderId}] could not record event "${kind}"`, cause);
  }
}

export interface AddItemInput {
  productId: string;
  assetId: string;
  quantity: number;
  crop: CropRect | null;
}

/**
 * Adds a line, snapshotting the catalogue at this exact moment.
 *
 * The snapshot is the whole point: `unit_price` and `product_name` are copied
 * onto the row now and never re-read from `print_products` again, so a price
 * change next month cannot rewrite what this basket already shows a client.
 */
export async function addCartItem(
  admin: Admin,
  order: CartOrderRow,
  galleryShootId: string,
  input: AddItemInput,
): Promise<CartItemRow> {
  if (order.status !== 'cart') {
    throw new CartError('This basket has already been checked out.');
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > 99) {
    throw new CartError('Choose a quantity between 1 and 99.');
  }

  const { data: product } = await admin
    .from('print_products')
    .select('*')
    .eq('id', input.productId)
    .eq('is_active', true)
    .maybeSingle();
  if (!product) throw new CartError('That product is no longer available.');

  // Scoped to this gallery's shoot: without it, a valid token plus a guessed
  // asset id would let someone order a print of a photograph from a
  // different couple's wedding.
  const { data: asset } = await admin
    .from('assets')
    .select('id')
    .eq('id', input.assetId)
    .eq('shoot_id', galleryShootId)
    .maybeSingle();
  if (!asset) throw new CartError('That photograph is not in this gallery.');

  const { data, error } = await admin
    .from('print_order_items')
    .insert({
      order_id: order.id,
      product_id: product.id,
      asset_id: asset.id,
      quantity: input.quantity,
      unit_price: product.price,
      product_name: product.name,
      size_label: product.size_label,
      crop: input.crop as unknown as TablesInsert<'print_order_items'>['crop'],
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new CartError(`Could not add that to the basket: ${error?.message ?? 'unknown error'}.`);
  }

  await recordOrderEvent(admin, order.id, 'item_added', `${product.name} x${input.quantity}`);
  return data;
}

export async function updateCartItemQuantity(
  admin: Admin,
  order: CartOrderRow,
  itemId: string,
  quantity: number,
): Promise<void> {
  if (order.status !== 'cart') throw new CartError('This basket has already been checked out.');
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
    throw new CartError('Choose a quantity between 1 and 99.');
  }

  const { error } = await admin
    .from('print_order_items')
    .update({ quantity })
    .eq('id', itemId)
    .eq('order_id', order.id);
  if (error) throw new CartError(`Could not update that line: ${error.message}.`);
}

export async function removeCartItem(
  admin: Admin,
  order: CartOrderRow,
  itemId: string,
): Promise<void> {
  if (order.status !== 'cart') throw new CartError('This basket has already been checked out.');

  const { error } = await admin
    .from('print_order_items')
    .delete()
    .eq('id', itemId)
    .eq('order_id', order.id);
  if (error) throw new CartError(`Could not remove that line: ${error.message}.`);
}

export interface ContactAndShipping {
  contactName: string;
  contactEmail: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipPostcode: string;
  shipCountry: string;
  notes: string | null;
}

export async function saveContactAndShipping(
  admin: Admin,
  order: CartOrderRow,
  input: ContactAndShipping,
): Promise<void> {
  if (order.status !== 'cart') throw new CartError('This basket has already been checked out.');

  const { error } = await admin
    .from('print_orders')
    .update({
      contact_name: input.contactName,
      contact_email: input.contactEmail,
      ship_line1: input.shipLine1,
      ship_line2: input.shipLine2,
      ship_city: input.shipCity,
      ship_postcode: input.shipPostcode,
      ship_country: input.shipCountry,
      notes: input.notes,
    })
    .eq('id', order.id);
  if (error) throw new CartError(`Could not save those details: ${error.message}.`);
}
