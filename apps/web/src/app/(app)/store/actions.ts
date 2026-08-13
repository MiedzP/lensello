'use server';

/**
 * Staff-side fulfilment actions.
 *
 * Every action starts with `requireUser()` — see AGENTS.md. These are the
 * only writes to `print_orders.status` past `paid`: the client-facing basket
 * (`app/g/[token]/shop/actions.ts`) can only ever create a cart or start a
 * checkout, never move an order into production or mark it delivered.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getIntegrations, IntegrationError } from '@lensello/core/integrations';
import type { LabOrderItem, LabOrderStatus } from '@lensello/core/integrations';
import { requireUser } from '@/lib/auth';
import { friendlyDbError } from '@/lib/schema-errors';
import { getOrderDetail } from '@/lib/prints/queries';
import { buildLabOrderItems, shippingAddressFrom } from '@/lib/prints/lab-items';
import type { Tables, TablesInsert } from '@/lib/db.types';
import type { OrderActionState } from './order-state';
import { ORDER_ACTION_IDLE } from './order-state';

const orderIdSchema = z.string().uuid('Unknown order.');

type PrintOrderStatus = Tables<'print_orders'>['status'];
type OrderEventPayload = TablesInsert<'print_order_events'>['payload'];

/** The lab's status vocabulary translated onto ours. `rejected` becomes `cancelled` — the order did not proceed, whatever the lab's reason. */
const LAB_STATUS_TO_ORDER_STATUS: Record<LabOrderStatus, PrintOrderStatus> = {
  received: 'submitted_to_lab',
  in_production: 'in_production',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
  rejected: 'cancelled',
};

/** Sends a paid order to the lab through the adapter. */
export async function submitOrderToLab(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const { supabase } = await requireUser();

  const parsed = orderIdSchema.safeParse(formData.get('orderId'));
  if (!parsed.success) return { ...ORDER_ACTION_IDLE, error: 'Unknown order.' };
  const orderId = parsed.data;

  const { data: order } = await supabase.from('print_orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ...ORDER_ACTION_IDLE, error: 'That order no longer exists.' };
  if (order.status !== 'paid') {
    return {
      ...ORDER_ACTION_IDLE,
      error: `This order is "${order.status}", not "paid". Only a paid order can be sent to the lab.`,
    };
  }

  let labItems: LabOrderItem[];
  try {
    const detail = await getOrderDetail(supabase, orderId);
    if (!detail) return { ...ORDER_ACTION_IDLE, error: 'That order no longer exists.' };

    const built = await buildLabOrderItems(supabase, detail);
    if (built.items.length === 0) {
      return {
        ...ORDER_ACTION_IDLE,
        message: 'Every line in this order is a digital download — there is nothing for the lab to print.',
      };
    }
    labItems = built.items;
  } catch (cause) {
    return { ...ORDER_ACTION_IDLE, error: cause instanceof Error ? cause.message : 'Could not prepare the order.' };
  }

  try {
    const { printLab } = getIntegrations();
    const result = await printLab.submitOrder({
      reference: order.id,
      items: labItems,
      shipTo: shippingAddressFrom(order),
    });

    const { error } = await supabase
      .from('print_orders')
      .update({
        status: LAB_STATUS_TO_ORDER_STATUS[result.status] ?? 'submitted_to_lab',
        lab_order_ref: result.labOrderRef,
        lab_status: result.status,
        lab_submitted_at: new Date().toISOString(),
        tracking_url: result.trackingUrl,
      })
      .eq('id', orderId);

    if (error) {
      return { ...ORDER_ACTION_IDLE, error: friendlyDbError(error, 'Sent to the lab but could not be recorded.') };
    }

    await supabase.from('print_order_events').insert({
      order_id: orderId,
      kind: 'submitted_to_lab',
      detail: result.labOrderRef,
      payload: result as unknown as OrderEventPayload,
    });
  } catch (cause) {
    await supabase.from('print_order_events').insert({
      order_id: orderId,
      kind: 'lab_submission_failed',
      detail: cause instanceof IntegrationError ? cause.message : 'Unknown error',
    });
    return {
      ...ORDER_ACTION_IDLE,
      error: `The lab did not accept this order: ${cause instanceof Error ? cause.message : 'unknown error'}. Use "Download CSV" to send it by hand instead.`,
    };
  }

  revalidatePath('/store');
  revalidatePath(`/store/orders/${orderId}`);
  return { ...ORDER_ACTION_IDLE, message: 'Sent to the lab.' };
}

/** Polls the lab for a status change and records the transition. */
export async function refreshLabStatus(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const { supabase } = await requireUser();

  const parsed = orderIdSchema.safeParse(formData.get('orderId'));
  if (!parsed.success) return { ...ORDER_ACTION_IDLE, error: 'Unknown order.' };
  const orderId = parsed.data;

  const { data: order } = await supabase.from('print_orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ...ORDER_ACTION_IDLE, error: 'That order no longer exists.' };
  if (!order.lab_order_ref) {
    return { ...ORDER_ACTION_IDLE, error: 'This order has not been sent to the lab yet.' };
  }

  try {
    const { printLab } = getIntegrations();
    const result = await printLab.orderStatus(order.lab_order_ref);
    const nextStatus = LAB_STATUS_TO_ORDER_STATUS[result.status] ?? order.status;

    if (result.status === order.lab_status) {
      return { ...ORDER_ACTION_IDLE, message: `Still "${result.status}" at the lab.` };
    }

    const { error } = await supabase
      .from('print_orders')
      .update({ status: nextStatus, lab_status: result.status, tracking_url: result.trackingUrl })
      .eq('id', orderId);

    if (error) {
      return { ...ORDER_ACTION_IDLE, error: friendlyDbError(error, 'Could not record the new status.') };
    }

    await supabase.from('print_order_events').insert({
      order_id: orderId,
      kind: 'lab_status_changed',
      detail: result.status,
      payload: result as unknown as OrderEventPayload,
    });
  } catch (cause) {
    return { ...ORDER_ACTION_IDLE, error: `Could not reach the lab: ${cause instanceof Error ? cause.message : 'unknown error'}` };
  }

  revalidatePath('/store');
  revalidatePath(`/store/orders/${orderId}`);
  return { ...ORDER_ACTION_IDLE, message: 'Status updated.' };
}

/** Cancels an order that has not shipped. Money already taken is a refund, handled separately — cancelling never touches Stripe on its own. */
export async function cancelOrder(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const { supabase } = await requireUser();

  const parsed = orderIdSchema.safeParse(formData.get('orderId'));
  if (!parsed.success) return { ...ORDER_ACTION_IDLE, error: 'Unknown order.' };
  const orderId = parsed.data;
  const reason = formData.get('reason');

  const { data: updated, error } = await supabase
    .from('print_orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .in('status', ['awaiting_payment', 'paid', 'submitted_to_lab'])
    .select('id')
    .maybeSingle();

  if (error) return { ...ORDER_ACTION_IDLE, error: friendlyDbError(error, 'Could not cancel the order.') };
  if (!updated) {
    return {
      ...ORDER_ACTION_IDLE,
      error: 'This order has already shipped, or is already closed out, and cannot be cancelled here.',
    };
  }

  await supabase.from('print_order_events').insert({
    order_id: orderId,
    kind: 'cancelled',
    detail: typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : null,
  });

  revalidatePath('/store');
  revalidatePath(`/store/orders/${orderId}`);
  return { ...ORDER_ACTION_IDLE, message: 'Order cancelled.' };
}

/** Records that a paid order was refunded. Stripe holds the actual refund — issue it there first; this is the studio's own record of why the order ended without a delivery. */
export async function markRefunded(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const { supabase } = await requireUser();

  const parsed = orderIdSchema.safeParse(formData.get('orderId'));
  if (!parsed.success) return { ...ORDER_ACTION_IDLE, error: 'Unknown order.' };
  const orderId = parsed.data;
  const reason = formData.get('reason');

  const { data: updated, error } = await supabase
    .from('print_orders')
    .update({ status: 'refunded' })
    .eq('id', orderId)
    .not('paid_at', 'is', null)
    .select('id')
    .maybeSingle();

  if (error) return { ...ORDER_ACTION_IDLE, error: friendlyDbError(error, 'Could not record the refund.') };
  if (!updated) {
    return { ...ORDER_ACTION_IDLE, error: 'This order was never marked paid, so there is nothing to refund.' };
  }

  await supabase.from('print_order_events').insert({
    order_id: orderId,
    kind: 'refunded',
    detail: typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : null,
  });

  revalidatePath('/store');
  revalidatePath(`/store/orders/${orderId}`);
  return { ...ORDER_ACTION_IDLE, message: 'Order marked refunded. Remember to issue the refund in Stripe too.' };
}
