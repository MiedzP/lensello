/**
 * Staff-side reads for the print store.
 *
 * These run under the caller's own session (`requireUser()`'s `supabase`),
 * never the service role — RLS on `print_products` / `print_orders` already
 * restricts every row to staff, so there is nothing extra to enforce here.
 */

import type { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/db.types';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PrintProductRow = Tables<'print_products'>;
export type PrintOrderRow = Tables<'print_orders'>;
export type PrintOrderItemRow = Tables<'print_order_items'>;
export type PrintOrderEventRow = Tables<'print_order_events'>;

export async function listProducts(
  supabase: Supabase,
  input: { activeOnly?: boolean } = {},
): Promise<PrintProductRow[]> {
  let query = supabase.from('print_products').select('*').order('sort_order', { ascending: true });
  if (input.activeOnly) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getProduct(
  supabase: Supabase,
  productId: string,
): Promise<PrintProductRow | null> {
  const { data } = await supabase
    .from('print_products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();
  return data ?? null;
}

export interface OrderListRow extends PrintOrderRow {
  itemCount: number;
}

/**
 * Every order except abandoned baskets nobody ever paid for — those are noise
 * on a fulfilment list.
 *
 * Two queries rather than an embedded `print_order_items(id)` select: the
 * hand-written `Database` type in db.types.ts declares no `Relationships`
 * (see its own comment on why), so Postgrest's embedded-resource typing has
 * nothing to key off and widens to an untyped error type instead.
 */
export async function listOrders(
  supabase: Supabase,
  input: { status?: PrintOrderRow['status'] } = {},
): Promise<OrderListRow[]> {
  let query = supabase.from('print_orders').select('*').order('created_at', { ascending: false });
  query = input.status ? query.eq('status', input.status) : query.neq('status', 'cart');

  const { data: orders, error } = await query;
  if (error) throw error;
  if (!orders?.length) return [];

  const { data: items } = await supabase
    .from('print_order_items')
    .select('order_id')
    .in('order_id', orders.map((order) => order.id));

  const itemCounts = new Map<string, number>();
  for (const item of items ?? []) {
    itemCounts.set(item.order_id, (itemCounts.get(item.order_id) ?? 0) + 1);
  }

  return orders.map((order) => ({ ...order, itemCount: itemCounts.get(order.id) ?? 0 }));
}

export interface OrderDetail {
  order: PrintOrderRow;
  items: PrintOrderItemRow[];
  events: PrintOrderEventRow[];
  assetPreviewByAssetId: Map<string, { url: string; filename: string }>;
}

/** Full detail for one order: its lines, its history, and a signed preview URL per asset ordered. */
export async function getOrderDetail(
  supabase: Supabase,
  orderId: string,
): Promise<OrderDetail | null> {
  const { data: order } = await supabase
    .from('print_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return null;

  const [{ data: items }, { data: events }] = await Promise.all([
    supabase
      .from('print_order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
    supabase
      .from('print_order_events')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
  ]);

  const assetIds = [...new Set((items ?? []).map((item) => item.asset_id))];
  const assetPreviewByAssetId = new Map<string, { url: string; filename: string }>();

  if (assetIds.length > 0) {
    const { data: assets } = await supabase
      .from('assets')
      .select('id, storage_path, filename')
      .in('id', assetIds);

    if (assets?.length) {
      const { data: signed } = await supabase.storage
        .from('photos')
        .createSignedUrls(assets.map((asset) => asset.storage_path), 60 * 30);

      const urlByPath = new Map(
        (signed ?? [])
          .filter((entry) => entry.signedUrl && entry.path)
          .map((entry) => [entry.path as string, entry.signedUrl as string]),
      );

      for (const asset of assets) {
        const url = urlByPath.get(asset.storage_path);
        if (url) assetPreviewByAssetId.set(asset.id, { url, filename: asset.filename });
      }
    }
  }

  return { order, items: items ?? [], events: events ?? [], assetPreviewByAssetId };
}
