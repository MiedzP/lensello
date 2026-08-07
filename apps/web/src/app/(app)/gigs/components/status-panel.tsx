'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { GIG_STATUS_LABELS, type GigStatus } from '@lensello/core';
import { Badge, Button, Card, CardBody, CardHeader, ErrorNote } from '@/components/ui';
import { whenLabel } from '@/lib/gigs/display';
import { GIG_STATUS_TONES, GIG_TRANSITIONS } from '@/lib/gigs/types';
import { EMPTY_STATUS_STATE } from '@/lib/gigs/action-state';
import { setGigStatus } from '../actions';

/**
 * Status transitions, with the calendar consequences spelled out.
 *
 * Only legal next states are offered, and the action re-checks the transition —
 * the buttons are a convenience, not the rule. Moving to a slot-holding status
 * re-runs the double-booking check, so confirming a gig that was entered as an
 * inquiry months ago cannot quietly collide with something booked since.
 */
export function StatusPanel({
  gigId,
  status,
  hasCalendarEvent,
  calendarStatus,
}: {
  gigId: string;
  status: GigStatus;
  hasCalendarEvent: boolean;
  /** Whether a real calendar is behind the sync, or the simulator. */
  calendarStatus: 'live' | 'mock' | 'unavailable';
}) {
  const [state, formAction, pending] = useActionState(setGigStatus, EMPTY_STATUS_STATE);
  const targets = GIG_TRANSITIONS[status];

  return (
    <Card>
      <CardHeader
        title="Status"
        description="Inquiry → hold → confirmed → completed, or cancelled at any point."
        action={<Badge tone={GIG_STATUS_TONES[status]}>{GIG_STATUS_LABELS[status]}</Badge>}
      />

      <CardBody className="space-y-3">
        {state.phase === 'error' && state.message ? (
          <ErrorNote>{state.message}</ErrorNote>
        ) : null}

        {state.phase === 'done' && state.message ? (
          <p
            role="status"
            className="rounded-md border border-subtle bg-surface-raised px-3 py-2 text-sm text-muted"
          >
            {state.message}
          </p>
        ) : null}

        {state.phase === 'conflict' && state.pendingStatus ? (
          <div
            role="alert"
            className="rounded-md border border-warning/40 bg-warning-subtle px-3 py-2.5 text-sm text-warning"
          >
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle size={16} aria-hidden="true" />
              Marking this {GIG_STATUS_LABELS[state.pendingStatus].toLowerCase()} would
              double book
            </p>

            <ul className="mt-2 space-y-1 pl-6">
              {state.conflicts.map((conflict) => (
                <li key={conflict.id}>
                  <Link
                    href={`/gigs/${conflict.id}`}
                    className="font-medium underline underline-offset-2"
                  >
                    {conflict.title}
                  </Link>
                  <span className="text-muted">
                    {' '}
                    — {whenLabel(conflict.startsAt, conflict.endsAt)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-2 text-muted">
              The status has not changed. Move the times, or go ahead if the overlap is
              intentional.
            </p>

            {/* A separate form so the pending status travels with the override and
                cannot collide with the transition buttons below. */}
            <form action={formAction} className="mt-3">
              <input type="hidden" name="gigId" value={gigId} />
              <input type="hidden" name="status" value={state.pendingStatus} />
              <input type="hidden" name="override" value="1" />
              <Button type="submit" size="sm" variant="danger" disabled={pending}>
                {pending
                  ? 'Working…'
                  : `Mark ${GIG_STATUS_LABELS[state.pendingStatus].toLowerCase()} anyway`}
              </Button>
            </form>
          </div>
        ) : null}

        <form action={formAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="gigId" value={gigId} />
          {targets.map((target) => (
            <Button
              key={target}
              type="submit"
              name="status"
              value={target}
              size="sm"
              variant={target === 'cancelled' ? 'danger' : 'secondary'}
              disabled={pending}
            >
              {ACTION_LABELS[target]}
            </Button>
          ))}
        </form>

        {calendarStatus === 'live' ? (
          <p className="text-xs text-muted">
            {hasCalendarEvent
              ? 'This gig is on the studio calendar. Editing its times updates the event; moving it off “confirmed” or cancelling removes it.'
              : 'Confirming a gig adds it to the studio calendar.'}
          </p>
        ) : (
          // The event id below is real and the sync logic runs, but it points at
          // the simulator. Saying "the connected calendar" here is how somebody
          // stops checking their actual diary for a booking that was never
          // written to it.
          <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning">
            <span className="font-medium">Calendar sync is simulated.</span>{' '}
            {hasCalendarEvent
              ? 'This gig has an event id, but it was issued by the built-in simulator — nothing was written to a real calendar.'
              : 'Confirming a gig records an event against the built-in simulator, not a real calendar.'}{' '}
            Keep booking times in your own diary until a calendar is connected —{' '}
            <Link href="/connections" className="font-medium underline underline-offset-2">
              the steps are on Connections
            </Link>
            .
          </p>
        )}
      </CardBody>
    </Card>
  );
}

/** Imperative labels — a button says what it does, not what state it names. */
const ACTION_LABELS: Record<GigStatus, string> = {
  inquiry: 'Back to inquiry',
  hold: 'Place tentative hold',
  confirmed: 'Confirm booking',
  completed: 'Mark completed',
  cancelled: 'Cancel gig',
};
