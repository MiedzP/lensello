/**
 * Turning a stored order into what the `PrintLab` adapter expects.
 *
 * Shared by the staff "submit to lab" action and the CSV export route, so the
 * two fulfilment paths — automatic and by-hand — always describe the same
 * order the same way.
 */

import type { LabOrderItem, LabShippingAddress } from '@lensello/core/integrations';
import type { getOrderDetail } from './queries';

type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;
type Supabase = Parameters<typeof getOrderDetail>[0];

export class LabItemsError extends Error {}

export async function buildLabOrderItems(
  supabase: Supabase,
  detail: OrderDetail,
): Promise<{ items: LabOrderItem[]; digitalCount: number }> {
  const productIds = [...new Set(detail.items.map((item) => item.product_id))];
  const { data: products } = await supabase
    .from('print_products')
    .select('id, lab_sku, is_digital')
    .in('id', productIds);
  const productById = new Map((products ?? []).map((product) => [product.id, product]));

  const physical = detail.items.filter((item) => !productById.get(item.product_id)?.is_digital);
  const digitalCount = detail.items.length - physical.length;

  const missingSku = physical.find((item) => !productById.get(item.product_id)?.lab_sku);
  if (missingSku) {
    throw new LabItemsError(
      `"${missingSku.product_name}" has no lab SKU mapped. Map it in the catalogue before sending this order to the lab.`,
    );
  }

  const items: LabOrderItem[] = physical.map((item) => ({
    labSku: productById.get(item.product_id)!.lab_sku!,
    quantity: item.quantity,
    imageUrl: detail.assetPreviewByAssetId.get(item.asset_id)?.url ?? '',
    crop: item.crop as LabOrderItem['crop'],
    reference: item.id,
  }));

  return { items, digitalCount };
}

export function shippingAddressFrom(order: {
  contact_name: string | null;
  ship_line1: string | null;
  ship_line2: string | null;
  ship_city: string | null;
  ship_postcode: string | null;
  ship_country: string;
}): LabShippingAddress {
  return {
    name: order.contact_name ?? '',
    line1: order.ship_line1 ?? '',
    line2: order.ship_line2,
    city: order.ship_city ?? '',
    postcode: order.ship_postcode ?? '',
    country: order.ship_country,
  };
}
