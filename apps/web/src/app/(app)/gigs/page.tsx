import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import { GIG_STATUS_LABELS, formatCents } from '@lensello/core';
import { Card, EmptyState, PageHeader, Stat } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { listGigs, listGigsOverlapping, mapClientsById } from '@/lib/gigs/queries';
import {
  monthLabel,
  monthRangeIso,
  parseMonthParam,
  parseStatusFilter,
  parseView,
} from '@/lib/gigs/display';
import { outstandingCents, type GigRow } from '@/lib/gigs/types';
import { GigCalendar } from './components/gig-calendar';
import { GigList } from './components/gig-list';
import { GigToolbar } from './components/gig-toolbar';

export const metadata: Metadata = { title: 'Gigs' };

const NEW_GIG_BUTTON = (
  <Link
    href="/gigs/new"
    className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
  >
    <CalendarPlus size={16} aria-hidden="true" />
    New gig
  </Link>
);

/**
 * `/gigs` — month calendar or list, filtered by status.
 *
 * `searchParams` is a Promise in Next 16, so it is awaited. Keeping the month,
 * view, and filter in the URL rather than in component state is what makes
 * "September 2026, confirmed only" a link you can send someone, and what makes
 * the browser's back button undo a month step.
 */
export default async function GigsPage(props: PageProps<'/gigs'>) {
  const searchParams = await props.searchParams;
  const { supabase } = await requireUserOrRedirect();

  const view = parseView(searchParams.view);
  const status = parseStatusFilter(searchParams.status);
  const month = parseMonthParam(searchParams.month);
  const { fromIso, toIso } = monthRangeIso(month);

  // Only the view being rendered is queried.
  const calendarGigs =
    view === 'calendar'
      ? await listGigsOverlapping(supabase, fromIso, toIso, status ?? undefined)
      : [];

  const buckets =
    view === 'list'
      ? await listGigs(supabase, { status: status ?? undefined })
      : { upcoming: [] as GigRow[], past: [] as GigRow[] };

  const visibleGigs =
    view === 'calendar' ? calendarGigs : [...buckets.upcoming, ...buckets.past];

  const clients = await mapClientsById(
    supabase,
    visibleGigs.map((gig) => gig.client_id),
  );

  const filterNote = status
    ? ` Showing ${GIG_STATUS_LABELS[status].toLowerCase()} gigs only.`
    : '';

  return (
    <>
      <PageHeader
        title="Gigs"
        description={`Booking calendar, shoot logistics, and deposits.${filterNote}`}
        action={NEW_GIG_BUTTON}
      />

      <GigToolbar view={view} month={month} status={status} />

      {view === 'calendar' ? (
        <>
          <MonthSummary gigs={calendarGigs} month={month} />
          <GigCalendar month={month} gigs={calendarGigs} status={status} />

          {calendarGigs.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title={`Nothing booked in ${monthLabel(month)}`}
                description={
                  status
                    ? 'No gigs match this status filter this month. Try “All”, or step to another month.'
                    : 'Pick a date in the grid above to start a booking, or use “New gig”.'
                }
              />
            </div>
          ) : null}
        </>
      ) : buckets.upcoming.length === 0 && buckets.past.length === 0 ? (
        <EmptyState
          title={status ? `No ${GIG_STATUS_LABELS[status].toLowerCase()} gigs` : 'No gigs yet'}
          description={
            status
              ? 'Nothing currently has this status. Clear the filter to see everything.'
              : 'When an inquiry turns into a date, add it here so it holds a slot on the calendar and the deposit gets chased.'
          }
          action={NEW_GIG_BUTTON}
        />
      ) : (
        <GigList upcoming={buckets.upcoming} past={buckets.past} clients={clients} />
      )}
    </>
  );
}

/**
 * Money for the visible month. Inquiries and cancellations are excluded — an
 * inquiry is not revenue, and counting it would flatter the number.
 */
function MonthSummary({ gigs, month }: { gigs: GigRow[]; month: Date }) {
  const active = gigs.filter(
    (gig) => gig.status !== 'cancelled' && gig.status !== 'inquiry',
  );
  if (active.length === 0) return null;

  const booked = active.reduce((total, gig) => total + gig.price_cents, 0);
  const depositsOwed = active
    .filter((gig) => !gig.deposit_paid_at)
    .reduce((total, gig) => total + gig.deposit_cents, 0);
  const balanceOwed = active
    .filter((gig) => !gig.balance_paid_at)
    .reduce((total, gig) => total + outstandingCents(gig), 0);

  return (
    <Card className="mb-5 grid grid-cols-1 divide-y divide-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Stat
        label="Booked"
        value={formatCents(booked)}
        hint={`${active.length} held, confirmed, or shot in ${monthLabel(month)}`}
      />
      <Stat
        label="Deposits owed"
        value={formatCents(depositsOwed)}
        hint="Deposit not yet recorded as paid"
      />
      <Stat
        label="Balance outstanding"
        value={formatCents(balanceOwed)}
        hint="Price less deposit, where unpaid"
      />
    </Card>
  );
}
