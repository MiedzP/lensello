import Link from 'next/link';
import { Card, CardHeader, CardBody, PageHeader, Stat, Badge } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { formatCents } from '@lensello/core';
import { PriorityCard } from './components/priority-card';
import { RecommendedActionCard } from './components/recommended-action-card';

/**
 * Phase 3: Photographer's Marketing HQ
 *
 * Answers three questions immediately:
 * 1. "What is happening?" → Quick stats
 * 2. "What needs my attention?" → 1-3 Red/Amber/Green priorities
 * 3. "What should I do next?" → Recommended action with 1-click execute
 */
export default async function DashboardPage() {
  const { supabase, profile } = await requireUserOrRedirect();

  const now = new Date().toISOString();

  // Parallel queries for dashboard data
  const [
    unhandled,
    upcomingGigs,
    activeCampaigns,
    activeAds,
    shoots,
    dashboardState,
  ] = await Promise.all([
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
    // Fetch dashboard_state if it exists (Phase 3)
    supabase
      .from('dashboard_state')
      .select(
        'new_enquiries_this_month, consultations_booked_this_month, bookings_this_month, pipeline_value_cents, top_3_priorities, recommended_action'
      )
      .eq('photographer_id', profile.id)
      .order('refreshed_at', { ascending: false })
      .limit(1),
  ]);

  const firstName = profile.full_name.split(' ')[0];
  const latestDashboardState = dashboardState.data?.[0];

  // Mock priorities for demo (will come from Phase 2 diagnostic)
  const mockPriorities = [
    {
      area: 'nurture' as const,
      status: 'red' as const,
      insight: 'Follow up 7 warm enquiries who haven\'t booked yet',
      recommended_action: {
        title: 'Create nurture campaign',
        action_type: 'auto_follow_up_email' as const,
      },
    },
    {
      area: 'visibility' as const,
      status: 'red' as const,
      insight: 'Your Meta creative needs refresh for better engagement',
      recommended_action: {
        title: 'Refresh Meta creative',
        action_type: 'ai_generate_variants' as const,
      },
    },
    {
      area: 'conversion' as const,
      status: 'amber' as const,
      insight: 'Blog content about venue partnerships could drive bookings',
      recommended_action: {
        title: 'Publish venue article',
        action_type: 'team_content_schedule' as const,
      },
    },
  ];

  const priorities = latestDashboardState?.top_3_priorities || mockPriorities;

  return (
    <>
      <div className="mb-8">
        <PageHeader
          title={firstName ? `Good morning, ${firstName}` : 'Dashboard'}
          description="Here's what's happening in your business."
        />
      </div>

      {/* SECTION 1: What is happening? */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          What's happening
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <Stat
              label="New enquiries this month"
              value={
                latestDashboardState?.new_enquiries_this_month ??
                unhandled.count ??
                0
              }
              hint={
                <Link
                  href="/clients"
                  className="text-accent hover:underline"
                >
                  View all
                </Link>
              }
            />
          </Card>
          <Card>
            <Stat
              label="Consultations booked"
              value={
                latestDashboardState?.consultations_booked_this_month ?? 6
              }
              hint={
                <Link
                  href="/gigs"
                  className="text-accent hover:underline"
                >
                  View calendar
                </Link>
              }
            />
          </Card>
          <Card>
            <Stat
              label="Weddings booked"
              value={latestDashboardState?.bookings_this_month ?? 4}
              hint={
                <Link href="/gigs" className="text-accent hover:underline">
                  View bookings
                </Link>
              }
            />
          </Card>
          <Card>
            <Stat
              label="Pipeline value"
              value={
                latestDashboardState?.pipeline_value_cents
                  ? formatCents(
                      latestDashboardState.pipeline_value_cents
                    )
                  : '£9,200'
              }
              hint={
                <Link
                  href="/clients"
                  className="text-accent hover:underline"
                >
                  View pipeline
                </Link>
              }
            />
          </Card>
        </div>
      </section>

      {/* SECTION 2: What needs my attention? */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Your marketing priorities
        </h2>
        <div className="space-y-3">
          {priorities && Array.isArray(priorities) && priorities.length > 0 ? (
            priorities.map((priority, idx) => (
              <PriorityCard key={idx} priority={priority} />
            ))
          ) : (
            <Card className="bg-subtle">
              <CardBody className="text-center text-sm text-muted">
                No priorities yet. Check back when diagnostics run.
              </CardBody>
            </Card>
          )}
        </div>
      </section>

      {/* SECTION 3: What should I do next? */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Opportunity
        </h2>
        <RecommendedActionCard />
      </section>

      {/* Fallback: Next up (from existing dashboard) */}
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
                    <Badge
                      tone={gig.status === 'confirmed' ? 'success' : 'warning'}
                    >
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
