import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { addHours, format, setHours, setMinutes } from 'date-fns';
import { PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { listClientRefs } from '@/lib/gigs/queries';
import { firstParam, parseDateParam } from '@/lib/gigs/display';
import { DATETIME_LOCAL_FORMAT, EMPTY_GIG_VALUES } from '@/lib/gigs/validation';
import { GigForm } from '../components/gig-form';

export const metadata: Metadata = { title: 'New gig' };

/** A shoot day starts mid-morning more often than it starts at midnight. */
const DEFAULT_START_HOUR = 10;
const DEFAULT_DURATION_HOURS = 4;

/**
 * `/gigs/new`
 *
 * `?date=YYYY-MM-DD` prefills the times, which is what clicking a day on the
 * calendar does. `?clientId=` lets the clients module hand an inquiry straight
 * over. Both are read from the awaited `searchParams` promise.
 */
export default async function NewGigPage(props: PageProps<'/gigs/new'>) {
  const searchParams = await props.searchParams;
  const { supabase } = await requireUserOrRedirect();

  const clients = await listClientRefs(supabase);

  const day = parseDateParam(searchParams.date);
  const requestedClientId = firstParam(searchParams.clientId) ?? '';
  const clientId = clients.some((client) => client.id === requestedClientId)
    ? requestedClientId
    : '';

  let startsAt = '';
  let endsAt = '';
  if (day) {
    const start = setMinutes(setHours(day, DEFAULT_START_HOUR), 0);
    startsAt = format(start, DATETIME_LOCAL_FORMAT);
    endsAt = format(addHours(start, DEFAULT_DURATION_HOURS), DATETIME_LOCAL_FORMAT);
  }

  return (
    <>
      <Link
        href="/gigs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to gigs
      </Link>

      <PageHeader
        title="New gig"
        description="Held and confirmed gigs are checked against the calendar for double bookings before saving."
      />

      <GigForm
        clients={clients}
        initialValues={{ ...EMPTY_GIG_VALUES, startsAt, endsAt, clientId }}
        submitLabel="Create gig"
        cancelHref="/gigs"
      />
    </>
  );
}
