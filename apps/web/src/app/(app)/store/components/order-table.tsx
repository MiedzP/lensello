import Link from 'next/link';
import { formatMinorUnits } from '@/lib/prints/money';
import { pluralize } from '@/lib/utils';
import type { OrderListRow } from '@/lib/prints/queries';
import { OrderStatusBadge } from './order-status-badge';

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function OrderTable({ orders }: { orders: OrderListRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-subtle">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-subtle bg-surface-raised text-xs font-medium text-muted uppercase">
          <tr>
            <th className="px-4 py-2.5">Order</th>
            <th className="px-4 py-2.5">Placed</th>
            <th className="px-4 py-2.5">Contact</th>
            <th className="px-4 py-2.5 text-right">Items</th>
            <th className="px-4 py-2.5 text-right">Total</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle">
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="px-4 py-2.5 font-mono text-xs text-faint">{order.id.slice(0, 8)}</td>
              <td className="px-4 py-2.5 text-muted">{when(order.created_at)}</td>
              <td className="px-4 py-2.5">
                <div className="text-foreground">{order.contact_name || '—'}</div>
                <div className="text-xs text-faint">{order.contact_email ?? ''}</div>
              </td>
              <td className="px-4 py-2.5 text-right text-muted">{pluralize(order.itemCount, 'item')}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                {formatMinorUnits(order.total, order.currency)}
              </td>
              <td className="px-4 py-2.5">
                <OrderStatusBadge status={order.status} />
              </td>
              <td className="px-4 py-2.5 text-right">
                <Link href={`/store/orders/${order.id}`} className="text-xs font-medium text-accent underline-offset-2 hover:underline">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
