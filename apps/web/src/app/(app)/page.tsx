import Link from 'next/link';
import { Card, CardHeader, CardBody, PageHeader, Badge } from '@/components/ui';
import { MetricCard } from '@/components/dashboard/metric-card';
import { ProjectCard } from '@/components/dashboard/project-card';
import { MessageSummary } from '@/components/dashboard/message-summary';
import { requireUserOrRedirect } from '@/lib/auth';
import { formatCents } from '@lensello/core';

export const dynamic = 'force-dynamic';

interface Project {
  id: string;
  name: string;
  client: string;
  status: 'active' | 'on_hold' | 'completed' | 'cancelled';
  deadline: string | null;
  progress: number;
}

interface Message {
  id: string;
  from: string;
  subject: string;
  preview: string;
  timestamp: string;
  is_unread?: boolean;
  is_handled?: boolean;
}

interface Invoice {
  id: string;
  amount_cents: number;
  due_date: string;
  status: 'draft' | 'sent' | 'paid';
  client_name: string;
}

/**
 * Fetch active projects (shoots in progress or confirmed gigs).
 */
async function getActiveProjects(supabase: any): Promise<Project[]> {
  const now = new Date().toISOString();

  const [shootsResult, gigsResult] = await Promise.all([
    supabase
      .from('shoots')
      .select('id, title, client_id, status, deadline, progress')
      .not('status', 'in', '("delivered","archived")')
      .limit(5),
    supabase
      .from('gigs')
      .select('id, title, client_id, status, starts_at, price_cents')
      .in('status', ['hold', 'confirmed'])
      .gte('starts_at', now)
      .limit(5),
  ]);

  const projects: Project[] = [];

  // Process shoots
  if (shootsResult.data) {
    projects.push(
      ...shootsResult.data.map((shoot: any) => ({
        id: shoot.id,
        name: shoot.title,
        client: shoot.client_id || 'Unknown Client',
        status: shoot.status === 'in_progress' ? 'active' : 'on_hold',
        deadline: shoot.deadline,
        progress: shoot.progress || 0,
      }))
    );
  }

  // Process gigs
  if (gigsResult.data) {
    projects.push(
      ...gigsResult.data.map((gig: any) => ({
        id: gig.id,
        name: gig.title,
        client: gig.client_id || 'Unknown Client',
        status: gig.status === 'confirmed' ? 'active' : 'on_hold',
        deadline: gig.starts_at,
        progress: 50, // Gigs don't have progress, use placeholder
      }))
    );
  }

  return projects.slice(0, 5);
}

/**
 * Fetch recent unhandled messages.
 */
async function getRecentMessages(supabase: any): Promise<Message[]> {
  const messagesResult = await supabase
    .from('messages')
    .select('id, from, subject, preview, created_at, is_unread, is_handled')
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!messagesResult.data) {
    return [];
  }

  return messagesResult.data.map((msg: any) => ({
    id: msg.id,
    from: msg.from || 'Unknown Sender',
    subject: msg.subject || '(No subject)',
    preview: msg.preview || '',
    timestamp: msg.created_at,
    is_unread: msg.is_unread,
    is_handled: msg.is_handled,
  }));
}

/**
 * Fetch pending invoices.
 */
async function getPendingInvoices(supabase: any): Promise<Invoice[]> {
  // Try to fetch from print_orders as invoices
  const invoicesResult = await supabase
    .from('print_orders')
    .select('id, total_amount_cents, due_date, status, client_id')
    .in('status', ['draft', 'sent'])
    .order('due_date', { ascending: true })
    .limit(10);

  if (!invoicesResult.data) {
    return [];
  }

  // Map print_orders to invoice format
  return invoicesResult.data.map((order: any) => ({
    id: order.id,
    amount_cents: order.total_amount_cents || 0,
    due_date: order.due_date,
    status: order.status,
    client_name: order.client_id || 'Unknown Client',
  }));
}

/**
 * Calculate key metrics.
 */
async function getMetrics(supabase: any) {
  const now = new Date().toISOString();

  const [
    activeProjectsResult,
    shootsResult,
    invoicesResult,
    revenueResult,
  ] = await Promise.all([
    supabase
      .from('shoots')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '("delivered","archived")'),
    supabase
      .from('gigs')
      .select('id, starts_at')
      .in('status', ['hold', 'confirmed'])
      .gte('starts_at', now),
    supabase
      .from('print_orders')
      .select('id, total_amount_cents', { count: 'exact', head: true })
      .in('status', ['draft', 'sent']),
    supabase
      .from('gigs')
      .select('price_cents')
      .eq('status', 'completed'),
  ]);

  const activeCount = (activeProjectsResult.count || 0) +
    (shootsResult.data?.length || 0);

  // Calculate average turnaround (days between gig date and completion)
  let avgTurnaround = 0;
  if (shootsResult.data && shootsResult.data.length > 0) {
    const turnarounds = shootsResult.data
      .filter((g: any) => g.starts_at)
      .map((g: any) => {
        const startDate = new Date(g.starts_at);
        const days = Math.floor(
          (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return Math.max(days, 1);
      });
    avgTurnaround = turnarounds.length > 0
      ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length)
      : 0;
  }

  const pendingInvoices = invoicesResult.count || 0;
  const pendingRevenue = invoicesResult.data?.reduce(
    (sum: number, inv: any) => sum + (inv.total_amount_cents || 0),
    0
  ) || 0;

  const totalRevenue = revenueResult.data?.reduce(
    (sum: number, gig: any) => sum + (gig.price_cents || 0),
    0
  ) || 0;

  return {
    activeProjects: activeCount,
    avgTurnaround,
    pendingInvoices,
    totalRevenue: Math.round((totalRevenue + pendingRevenue) / 100),
    pendingRevenue: Math.round(pendingRevenue / 100),
  };
}

/**
 * Dashboard with unified view of active projects, messages, and metrics.
 */
export default async function DashboardPage() {
  const { supabase, profile } = await requireUserOrRedirect();

  // Fetch all dashboard data in parallel
  const [projects, messages, invoices, metrics] = await Promise.all([
    getActiveProjects(supabase),
    getRecentMessages(supabase),
    getPendingInvoices(supabase),
    getMetrics(supabase),
  ]);

  const firstName = profile.full_name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        description="Overview of your active projects, messages, and key metrics."
      />

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active Projects"
          value={metrics.activeProjects}
          icon="📋"
          hint={`${metrics.activeProjects} in progress`}
        />
        <MetricCard
          label="Avg Turnaround"
          value={`${metrics.avgTurnaround}d`}
          icon="⏱"
          hint="Days from start to completion"
        />
        <MetricCard
          label="Pending Invoices"
          value={metrics.pendingInvoices}
          icon="📄"
          color="warning"
          hint={`$${metrics.pendingRevenue.toLocaleString()} due`}
        />
        <MetricCard
          label="Total Revenue"
          value={`$${metrics.totalRevenue.toLocaleString()}`}
          icon="💰"
          color="success"
          hint="All-time earned"
        />
      </div>

      {/* Active Projects */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Active Projects
            </h2>
            <p className="text-sm text-muted mt-0.5">
              Top 5 projects in progress
            </p>
          </div>
          <Link
            href="/library"
            className="text-sm text-accent hover:underline"
          >
            View all
          </Link>
        </div>

        {projects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={{
                  ...project,
                  href: `/library/${project.id}`,
                }}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardBody>
              <p className="text-center text-sm text-muted py-8">
                No active projects. Start a new one to get started.
              </p>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Recent Messages */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Recent Messages
            </h2>
            <p className="text-sm text-muted mt-0.5">
              Latest client communications
            </p>
          </div>
          <Link
            href="/clients"
            className="text-sm text-accent hover:underline"
          >
            View inbox
          </Link>
        </div>

        {messages.length > 0 ? (
          <div className="grid gap-3">
            {messages.map((message) => (
              <MessageSummary
                key={message.id}
                message={{
                  ...message,
                  href: `/clients#message-${message.id}`,
                }}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardBody>
              <p className="text-center text-sm text-muted py-8">
                No recent messages. Check back soon!
              </p>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Pending Invoices */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Pending Invoices
            </h2>
            <p className="text-sm text-muted mt-0.5">
              Unpaid or unsent invoices
            </p>
          </div>
          <Link
            href="/invoices"
            className="text-sm text-accent hover:underline"
          >
            View all
          </Link>
        </div>

        {invoices.length > 0 ? (
          <Card>
            <CardBody className="p-0">
              <ul className="divide-y divide-subtle">
                {invoices.slice(0, 5).map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-subtle transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        Invoice {invoice.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {invoice.client_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="font-medium text-foreground">
                          {formatCents(invoice.amount_cents)}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          Due{' '}
                          {new Date(invoice.due_date).toLocaleDateString(
                            'en-US',
                            { month: 'short', day: 'numeric' }
                          )}
                        </p>
                      </div>
                      <Badge
                        tone={
                          invoice.status === 'paid'
                            ? 'success'
                            : invoice.status === 'sent'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {invoice.status === 'draft'
                          ? 'Draft'
                          : invoice.status === 'sent'
                          ? 'Sent'
                          : 'Paid'}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <p className="text-center text-sm text-muted py-8">
                No pending invoices. All caught up!
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
