import Link from 'next/link';
import { Card, CardHeader, CardBody, PageHeader, Stat, Badge } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { formatCents } from '@lensello/core';

/**
 * Dashboard. Deliberately thin: it links into the modules rather than
 * duplicating their logic, so each module team owns its own detail views.
 */
export default async function DashboardPage() {
  const { supabase, profile } = await requireUserOrRedirect();

  const now = new Date().toISOString();

  // Parallel — these are independent reads and the page waits on all of them.
  const [unhandled, upcomingGigs, activeCampaigns, activeAds, shoots] =
    await Promise.all([
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'inbound')
        .eq('is_handled', false),
      supabase
        .from('gigs')
        .select('id, title, starts_at, status, price_cents')
        .in('status', ['hold', 'confirmed'])
        .gte('starts_at', now)
        .order('starts_at', { ascending: true })
        .limit(5),
      supabase
        .from('campaigns')
        .select('id', { count: 'exact', head: true })
        .in('status', ['scheduled', 'active']),
      supabase
        .from('ads')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('shoots')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', '("delivered","archived")'),
    ]);

  const firstName = profile.full_name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        description="What needs attention across the studio today."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat
            label="Needs reply"
            value={unhandled.count ?? 0}
            hint={<Link href="/clients" className="text-accent hover:underline">Open inbox</Link>}
          />
        </Card>
        <Card>
          <Stat
            label="Shoots in progress"
            value={shoots.count ?? 0}
            hint={<Link href="/library" className="text-accent hover:underline">Open library</Link>}
          />
        </Card>
        <Card>
          <Stat
            label="Live campaigns"
            value={activeCampaigns.count ?? 0}
            hint={<Link href="/campaigns" className="text-accent hover:underline">Open campaigns</Link>}
          />
        </Card>
        <Card>
          <Stat
            label="Running ads"
            value={activeAds.count ?? 0}
            hint={<Link href="/ads" className="text-accent hover:underline">Open ads</Link>}
          />
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Next up"
          description="Confirmed and tentative gigs, soonest first."
          action={
            <Link href="/gigs" className="text-sm text-accent hover:underline">
              All gigs
            </Link>
          }
        />
        <CardBody className="p-0">
          {upcomingGigs.data && upcomingGigs.data.length > 0 ? (
            <ul className="divide-y divide-subtle">
              {upcomingGigs.data.map((gig) => (
                <li
                  key={gig.id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {gig.title}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(gig.starts_at).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm tabular-nums text-muted">
                      {formatCents(gig.price_cents)}
                    </span>
                    <Badge tone={gig.status === 'confirmed' ? 'success' : 'warning'}>
                      {gig.status === 'confirmed' ? 'Confirmed' : 'Hold'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted">
              Nothing on the calendar yet.
            </p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
