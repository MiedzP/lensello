import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { GIG_STATUS_LABELS, SHOOT_TYPE_LABELS, formatCents } from '@lensello/core';
import { Badge, Button, Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { getSession, requireUserOrRedirect } from '@/lib/auth';
import {
  getGig,
  getShootForGig,
  listClientRefs,
  listGigTasks,
  listUnlinkedShoots,
} from '@/lib/gigs/queries';
import { whenLabel } from '@/lib/gigs/display';
import { GIG_STATUS_TONES, GIG_TRANSITIONS, outstandingCents } from '@/lib/gigs/types';
import { centsToInput, toDateTimeLocal } from '@/lib/gigs/validation';
import { deleteGig } from '../actions';
import { GigForm } from '../components/gig-form';
import { PaymentsPanel } from '../components/payments-panel';
import { ShootPanel } from '../components/shoot-panel';
import { StatusPanel } from '../components/status-panel';
import { TaskChecklist } from '../components/task-checklist';

export async function generateMetadata(
  props: PageProps<'/gigs/[gigId]'>,
): Promise<Metadata> {
  const { gigId } = await props.params;
  const session = await getSession();
  if (!session) return { title: 'Gig' };

  const gig = await getGig(session.supabase, gigId);
  return { title: gig ? gig.title : 'Gig not found' };
}

/** Dates are formatted here, on the server, and passed down as strings. */
function dateLabel(iso: string | null): string | null {
  if (!iso) return null;
  return format(parseISO(iso), 'd MMM yyyy');
}

/**
 * `/gigs/[gigId]` — the whole record: editable fields, checklist, status,
 * payments, and the library handoff.
 *
 * `params` is a Promise in Next 16, so it is awaited.
 */
export default async function GigDetailPage(props: PageProps<'/gigs/[gigId]'>) {
  const { gigId } = await props.params;
  const { supabase } = await requireUserOrRedirect();

  const gig = await getGig(supabase, gigId);
  if (!gig) notFound();

  const [tasks, clients, shoot] = await Promise.all([
    listGigTasks(supabase, gig.id),
    listClientRefs(supabase),
    getShootForGig(supabase, gig.id),
  ]);

  // Only needed for the completion handoff, so only fetched then.
  const shootCandidates =
    gig.status === 'completed' && !shoot ? await listUnlinkedShoots(supabase) : [];

  const client = gig.client_id
    ? clients.find((candidate) => candidate.id === gig.client_id)
    : undefined;

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
        title={gig.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{SHOOT_TYPE_LABELS[gig.type]}</span>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            <span>{whenLabel(gig.starts_at, gig.ends_at)}</span>
            {gig.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} aria-hidden="true" />
                {gig.location}
              </span>
            ) : null}
          </span>
        }
        action={
          <Badge tone={GIG_STATUS_TONES[gig.status]}>{GIG_STATUS_LABELS[gig.status]}</Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="gig-details-heading">
            <h2
              id="gig-details-heading"
              className="mb-3 text-sm font-semibold text-foreground"
            >
              Details
            </h2>
            <GigForm
              clients={clients}
              gigId={gig.id}
              submitLabel="Save changes"
              cancelHref="/gigs"
              statusOptions={[gig.status, ...GIG_TRANSITIONS[gig.status]]}
              initialValues={{
                title: gig.title,
                type: gig.type,
                status: gig.status,
                startsAt: toDateTimeLocal(gig.starts_at),
                endsAt: toDateTimeLocal(gig.ends_at),
                location: gig.location ?? '',
                clientId: gig.client_id ?? '',
                price: centsToInput(gig.price_cents),
                deposit: centsToInput(gig.deposit_cents),
                notes: gig.notes ?? '',
              }}
            />
          </section>

          <TaskChecklist gigId={gig.id} tasks={tasks} />
        </div>

        <div className="space-y-6">
          <StatusPanel
            gigId={gig.id}
            status={gig.status}
            hasCalendarEvent={gig.calendar_event_id !== null}
          />

          <PaymentsPanel
            gigId={gig.id}
            priceCents={gig.price_cents}
            depositCents={gig.deposit_cents}
            outstandingCents={outstandingCents(gig)}
            depositPaidAt={gig.deposit_paid_at}
            balancePaidAt={gig.balance_paid_at}
            depositPaidLabel={dateLabel(gig.deposit_paid_at)}
            balancePaidLabel={dateLabel(gig.balance_paid_at)}
            depositUrl={gig.deposit_payment_url}
            balanceUrl={gig.balance_payment_url}
            depositRequested={gig.deposit_payment_id !== null}
            balanceRequested={gig.balance_payment_id !== null}
          />

          {client ? (
            <Card>
              <CardHeader title="Client" />
              <CardBody className="space-y-1">
                <p className="text-sm font-medium text-foreground">{client.name}</p>
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="block text-sm text-accent underline underline-offset-2"
                  >
                    {client.email}
                  </a>
                ) : (
                  <p className="text-sm text-muted">No email on file.</p>
                )}
              </CardBody>
            </Card>
          ) : null}

          <ShootPanel
            gigId={gig.id}
            status={gig.status}
            shoot={shoot}
            candidates={shootCandidates}
            shotAtLabel={dateLabel(shoot?.shot_at ?? null)}
          />

          <Card>
            <CardHeader
              title="Danger zone"
              description={`${formatCents(gig.price_cents)} booked. Cancelling keeps the record; deleting does not.`}
            />
            <CardBody>
              {/* A disclosure, so the destructive button cannot be hit by a
                  stray click. No JavaScript involved. */}
              <details className="group">
                <summary className="cursor-pointer text-sm text-muted marker:text-faint hover:text-foreground">
                  Delete this gig permanently
                </summary>
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-muted">
                    This removes the gig and its checklist. Any linked shoot survives with
                    its gig link cleared, and the calendar event is removed. Prefer
                    “Cancel gig” unless this was entered by mistake.
                  </p>
                  <form action={deleteGig}>
                    <input type="hidden" name="gigId" value={gig.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Delete permanently
                    </Button>
                  </form>
                </div>
              </details>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
