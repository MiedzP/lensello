import type { Metadata } from 'next';
import Link from 'next/link';
import { ShoppingBag, Tags } from 'lucide-react';
import { EmptyState, PageHeader, Stat } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { listOrders } from '@/lib/prints/queries';
import type { Tables } from '@/lib/db.types';
import { ORDER_STATUS_LABELS } from '@/lib/prints/labels';
import { cn } from '@/lib/utils';
import { OrderTable } from './components/order-table';

export const metadata: Metadata = { title: 'Store' };

type OrderStatus = Tables<'print_orders'>['status'];

const FILTERS: { label: string; status: OrderStatus | undefined }[] = [
  { label: 'All', status: undefined },
  { label: ORDER_STATUS_LABELS.paid, status: 'paid' },
  { label: ORDER_STATUS_LABELS.submitted_to_lab, status: 'submitted_to_lab' },
  { label: ORDER_STATUS_LABELS.in_production, status: 'in_production' },
  { label: ORDER_STATUS_LABELS.shipped, status: 'shipped' },
];

export default async function StorePage(props: PageProps<'/store'>) {
  const { supabase } = await requireUserOrRedirect();
  const searchParams = await props.searchParams;
  const statusParam = typeof searchParams.status === 'string' ? searchParams.status : undefined;
  const status = FILTERS.find((filter) => filter.status === statusParam)?.status;

  const allOrders = await listOrders(supabase);
  const orders = status ? allOrders.filter((order) => order.status === status) : allOrders;

  const readyToSubmit = allOrders.filter((order) => order.status === 'paid').length;
  const inProgress = allOrders.filter((order) => order.status === 'submitted_to_lab' || order.status === 'in_production').length;
  const shippedOrDelivered = allOrders.filter((order) => order.status === 'shipped' || order.status === 'delivered').length;

  return (
    <>
      <PageHeader
        title="Store"
        description="Print catalogue, client orders and lab fulfilment."
        action={
          <Link
            href="/store/catalogue"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <Tags size={15} aria-hidden="true" />
            Manage catalogue
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-subtle bg-subtle sm:grid-cols-3">
        <div className="bg-surface">
          <Stat label="Ready to submit" value={readyToSubmit} hint="Paid, waiting to go to the lab" />
        </div>
        <div className="bg-surface">
          <Stat label="In progress" value={inProgress} hint="With the lab" />
        </div>
        <div className="bg-surface">
          <Stat label="Shipped or delivered" value={shippedOrDelivered} />
        </div>
      </div>

      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => {
          const isActive = filter.status === status;
          return (
            <Link
              key={filter.label}
              href={filter.status ? `/store?status=${filter.status}` : '/store'}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                isActive ? 'bg-accent-subtle text-accent' : 'text-muted hover:bg-surface-hover hover:text-foreground',
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={22} aria-hidden="true" />}
          title="No orders yet"
          description="Orders placed from a gallery's buying page will show up here once a client pays."
        />
      ) : (
        <OrderTable orders={orders} />
      )}
    </>
  );
}
