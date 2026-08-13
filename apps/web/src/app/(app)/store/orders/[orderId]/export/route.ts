import { NextResponse } from 'next/server';
import { getIntegrations } from '@lensello/core/integrations';
import { requireUser } from '@/lib/auth';
import { getOrderDetail } from '@/lib/prints/queries';
import { buildLabOrderItems, shippingAddressFrom } from '@/lib/prints/lab-items';

export const dynamic = 'force-dynamic';

/**
 * The manual-fulfilment path: a CSV spec sheet for emailing to a lab by hand.
 *
 * Exists because no UK lab is wired up yet (see `PrintLab` in
 * `packages/core/src/integrations/types.ts`) — a studio can sell prints today
 * and fulfil every one of them from this file while a live integration is
 * still just a plan.
 */
export async function GET(_request: Request, props: RouteContext<'/store/orders/[orderId]/export'>) {
  const { supabase, user } = await requireUser();
  const { orderId } = await props.params;

  const detail = await getOrderDetail(supabase, orderId);
  if (!detail) {
    return NextResponse.json({ error: 'That order no longer exists.' }, { status: 404 });
  }

  let items;
  try {
    items = (await buildLabOrderItems(supabase, detail)).items;
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : 'Could not prepare the export.' },
      { status: 400 },
    );
  }

  if (items.length === 0) {
    return NextResponse.json(
      { error: 'Every line in this order is a digital download — there is nothing for a lab to print.' },
      { status: 400 },
    );
  }

  const { printLab } = getIntegrations();
  const file = await printLab.exportOrder({
    reference: detail.order.id,
    items,
    shipTo: shippingAddressFrom(detail.order),
  });

  await supabase.from('print_order_events').insert({
    order_id: orderId,
    kind: 'exported',
    detail: `Downloaded by ${user.email ?? user.id}`,
  });

  return new NextResponse(file.body, {
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
    },
  });
}
