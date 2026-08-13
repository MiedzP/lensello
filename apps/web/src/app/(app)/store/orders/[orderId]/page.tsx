import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { getOrderDetail } from '@/lib/prints/queries';
import { formatMinorUnits } from '@/lib/prints/money';
import { OrderStatusBadge } from '../../components/order-status-badge';
import { FulfilmentActions } from './components/fulfilment-actions';

export const metadata: Metadata = { title: 'Order — Store' };

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function OrderDetailPage(props: PageProps<'/store/orders/[orderId]'>) {
  const { supabase } = await requireUserOrRedirect();
  const { orderId } = await props.params;

  const detail = await getOrderDetail(supabase, orderId);
  if (!detail) notFound();

  const { order, items, events, assetPreviewByAssetId } = detail;

  return (
    <>
      <PageHeader
        title={`Order ${order.id.slice(0, 8)}`}
        description={`Placed ${when(order.created_at)}`}
        action={
          <Link href="/store" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
            <ArrowLeft size={15} aria-hidden="true" />
            All orders
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Items" />
            <CardBody className="space-y-3">
              {items.map((item) => {
                const preview = assetPreviewByAssetId.get(item.asset_id);
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL, not an optimizable asset.
                      <img
                        src={preview.url}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-md border border-subtle object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-md border border-dashed border-subtle" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{item.product_name}</div>
                      <div className="text-xs text-faint">
                        {item.size_label ? `${item.size_label} · ` : ''}
                        Qty {item.quantity} × {formatMinorUnits(item.unit_price, order.currency)}
                      </div>
                    </div>
                    <div className="shrink-0 tabular-nums text-foreground">
                      {formatMinorUnits(item.unit_price * item.quantity, order.currency)}
                    </div>
                  </div>
                );
              })}

              <div className="mt-4 space-y-1 border-t border-subtle pt-3 text-sm">
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatMinorUnits(order.subtotal, order.currency)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Shipping</span>
                  <span className="tabular-nums">{formatMinorUnits(order.shipping, order.currency)}</span>
                </div>
                {order.tax > 0 ? (
                  <div className="flex justify-between text-muted">
                    <span>Tax</span>
                    <span className="tabular-nums">{formatMinorUnits(order.tax, order.currency)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-base font-semibold text-foreground">
                  <span>Total</span>
                  <span className="tabular-nums">{formatMinorUnits(order.total, order.currency)}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Fulfilment" description="Send this order to the lab, or export it to email by hand." />
            <CardBody>
              <FulfilmentActions
                orderId={order.id}
                status={order.status}
                labOrderRef={order.lab_order_ref}
                paidAt={order.paid_at}
                exportHref={`/store/orders/${order.id}/export`}
              />
              {order.lab_order_ref ? (
                <p className="mt-3 text-xs text-faint">
                  Lab reference {order.lab_order_ref}
                  {order.lab_status ? ` · ${order.lab_status}` : ''}
                  {order.tracking_url ? (
                    <>
                      {' · '}
                      <a href={order.tracking_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                        Track shipment
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="History" />
            <CardBody>
              {events.length === 0 ? (
                <p className="text-sm text-muted">Nothing recorded yet.</p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {events.map((event) => (
                    <li key={event.id} className="flex gap-3">
                      <span className="w-36 shrink-0 text-xs text-faint">{when(event.created_at)}</span>
                      <span className="text-foreground">
                        {event.kind}
                        {event.detail ? <span className="text-muted"> — {event.detail}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Status" />
            <CardBody>
              <OrderStatusBadge status={order.status} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contact" />
            <CardBody className="space-y-1 text-sm">
              <div className="font-medium text-foreground">{order.contact_name || '—'}</div>
              <div className="text-muted">{order.contact_email || '—'}</div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Delivery address" />
            <CardBody className="space-y-0.5 text-sm text-muted">
              <div>{order.ship_line1 || '—'}</div>
              {order.ship_line2 ? <div>{order.ship_line2}</div> : null}
              <div>{[order.ship_city, order.ship_postcode].filter(Boolean).join(' ')}</div>
              <div>{order.ship_country}</div>
            </CardBody>
          </Card>

          {order.notes ? (
            <Card>
              <CardHeader title="Notes from the client" />
              <CardBody className="text-sm text-muted">{order.notes}</CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
