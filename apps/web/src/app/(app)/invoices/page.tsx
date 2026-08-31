import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardBody,
  PageHeader,
  Badge,
  Button,
} from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { formatCents } from '@lensello/core';

export const dynamic = 'force-dynamic';

interface Invoice {
  id: string;
  amount_cents: number;
  due_date: string;
  status: 'draft' | 'sent' | 'paid';
  client_name: string;
  client_id: string;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
}

const statusConfig: Record<
  Invoice['status'],
  { label: string; tone: 'success' | 'warning' | 'neutral' | 'error' }
> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
};

/**
 * Fetch all invoices, optionally filtered by status.
 */
async function getInvoices(
  supabase: any,
  status?: Invoice['status']
): Promise<Invoice[]> {
  let query = supabase
    .from('print_orders')
    .select(
      'id, total_amount_cents, due_date, status, client_id, created_at, sent_at, paid_at'
    )
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const result = await query;

  if (!result.data) {
    return [];
  }

  return result.data.map((order: any) => ({
    id: order.id,
    amount_cents: order.total_amount_cents || 0,
    due_date: order.due_date,
    status: order.status,
    client_name: order.client_id || 'Unknown Client',
    client_id: order.client_id,
    created_at: order.created_at,
    sent_at: order.sent_at,
    paid_at: order.paid_at,
  }));
}

/**
 * Calculate invoice statistics.
 */
async function getInvoiceStats(supabase: any) {
  const [drafted, sent, paid] = await Promise.all([
    supabase
      .from('print_orders')
      .select('total_amount_cents', { count: 'exact', head: true })
      .eq('status', 'draft'),
    supabase
      .from('print_orders')
      .select('total_amount_cents', { count: 'exact', head: true })
      .eq('status', 'sent'),
    supabase
      .from('print_orders')
      .select('total_amount_cents')
      .eq('status', 'paid'),
  ]);

  const totalDrafted = drafted.data?.reduce(
    (sum: number, inv: any) => sum + (inv.total_amount_cents || 0),
    0
  ) || 0;

  const totalSent = sent.data?.reduce(
    (sum: number, inv: any) => sum + (inv.total_amount_cents || 0),
    0
  ) || 0;

  const totalPaid = paid.data?.reduce(
    (sum: number, inv: any) => sum + (inv.total_amount_cents || 0),
    0
  ) || 0;

  return {
    draftCount: drafted.count || 0,
    sentCount: sent.count || 0,
    paidCount: paid.count || 0,
    draftAmount: totalDrafted,
    sentAmount: totalSent,
    paidAmount: totalPaid,
  };
}

/**
 * Invoices page with filtering and management.
 */
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { supabase } = await requireUserOrRedirect();
  const params = await searchParams;

  const selectedStatus = (params.status as Invoice['status']) || 'all';
  const invoices = await getInvoices(supabase, selectedStatus);
  const stats = await getInvoiceStats(supabase);

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Manage and track your invoices"
        action={
          <Link href="/invoices/new">
            <Button>Create Invoice</Button>
          </Link>
        }
      />

      {/* Invoice Statistics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Draft
            </p>
            <p className="mt-1.5 text-2xl font-semibold text-foreground">
              {stats.draftCount}
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatCents(stats.draftAmount)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Sent
            </p>
            <p className="mt-1.5 text-2xl font-semibold text-foreground">
              {stats.sentCount}
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatCents(stats.sentAmount)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Paid
            </p>
            <p className="mt-1.5 text-2xl font-semibold text-foreground">
              {stats.paidCount}
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatCents(stats.paidAmount)}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="mt-6 flex gap-2 border-b border-subtle">
        <Link
          href="/invoices"
          className={`pb-3 px-3 text-sm font-medium transition-colors ${
            selectedStatus === 'all'
              ? 'text-accent border-b-2 border-accent'
              : 'text-muted hover:text-foreground'
          }`}
        >
          All
        </Link>
        <Link
          href="/invoices?status=draft"
          className={`pb-3 px-3 text-sm font-medium transition-colors ${
            selectedStatus === 'draft'
              ? 'text-accent border-b-2 border-accent'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Draft
        </Link>
        <Link
          href="/invoices?status=sent"
          className={`pb-3 px-3 text-sm font-medium transition-colors ${
            selectedStatus === 'sent'
              ? 'text-accent border-b-2 border-accent'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Sent
        </Link>
        <Link
          href="/invoices?status=paid"
          className={`pb-3 px-3 text-sm font-medium transition-colors ${
            selectedStatus === 'paid'
              ? 'text-accent border-b-2 border-accent'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Paid
        </Link>
      </div>

      {/* Invoices List */}
      <div className="mt-6">
        {invoices.length > 0 ? (
          <Card>
            <CardBody className="p-0">
              <div className="divide-y divide-subtle">
                {/* Header */}
                <div className="hidden md:grid md:grid-cols-6 gap-4 px-5 py-3 bg-subtle text-xs font-semibold text-muted uppercase">
                  <div>Invoice ID</div>
                  <div>Client</div>
                  <div>Amount</div>
                  <div>Due Date</div>
                  <div>Status</div>
                  <div className="text-right">Actions</div>
                </div>

                {/* Invoice Rows */}
                {invoices.map((invoice) => {
                  const config = statusConfig[invoice.status];
                  const isInvoiceOverdue =
                    invoice.status !== 'paid' && isOverdue(invoice.due_date);

                  return (
                    <div
                      key={invoice.id}
                      className="px-5 py-4 hover:bg-subtle transition-colors"
                    >
                      <div className="grid md:grid-cols-6 gap-4 items-center">
                        {/* Mobile: Stacked */}
                        <div className="md:hidden">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-foreground">
                                {invoice.id.slice(0, 12)}...
                              </p>
                              <p className="text-sm text-muted mt-0.5">
                                {invoice.client_name}
                              </p>
                            </div>
                            <Badge tone={config.tone}>{config.label}</Badge>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted">Amount:</span>
                            <span className="font-semibold">
                              {formatCents(invoice.amount_cents)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted">Due:</span>
                            <span
                              className={
                                isInvoiceOverdue
                                  ? 'text-error text-sm font-medium'
                                  : 'text-sm'
                              }
                            >
                              {new Date(invoice.due_date).toLocaleDateString(
                                'en-US',
                                { month: 'short', day: 'numeric', year: 'numeric' }
                              )}
                              {isInvoiceOverdue && ' ⚠'}
                            </span>
                          </div>
                        </div>

                        {/* Desktop: Table */}
                        <div className="hidden md:block">
                          <p className="font-medium text-foreground">
                            {invoice.id.slice(0, 12)}...
                          </p>
                        </div>
                        <div className="hidden md:block">
                          <p className="text-sm text-muted">
                            {invoice.client_name}
                          </p>
                        </div>
                        <div className="hidden md:block">
                          <p className="font-medium">
                            {formatCents(invoice.amount_cents)}
                          </p>
                        </div>
                        <div className="hidden md:block">
                          <p
                            className={
                              isInvoiceOverdue
                                ? 'text-error font-medium'
                                : 'text-foreground'
                            }
                          >
                            {new Date(invoice.due_date).toLocaleDateString(
                              'en-US',
                              { month: 'short', day: 'numeric' }
                            )}
                            {isInvoiceOverdue && ' ⚠'}
                          </p>
                        </div>
                        <div className="hidden md:block">
                          <Badge tone={config.tone}>{config.label}</Badge>
                        </div>
                        <div className="hidden md:block text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/invoices/${invoice.id}`}
                              className="text-xs text-accent hover:underline"
                            >
                              View
                            </Link>
                            {invoice.status === 'draft' && (
                              <>
                                <span className="text-muted">·</span>
                                <button className="text-xs text-accent hover:underline">
                                  Send
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <div className="py-12 text-center">
                <p className="text-lg font-medium text-foreground">
                  No invoices yet
                </p>
                <p className="text-sm text-muted mt-1 mb-4">
                  {selectedStatus === 'all'
                    ? 'Create your first invoice to get started.'
                    : `No ${selectedStatus} invoices at this time.`}
                </p>
                <Link href="/invoices/new">
                  <Button size="sm">Create Invoice</Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
