'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import {
  GIG_STATUSES,
  GIG_STATUS_LABELS,
  SHOOT_TYPES,
  SHOOT_TYPE_LABELS,
  type GigStatus,
} from '@lensello/core';
import { Button, Card, CardBody, CardFooter, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui';
import { whenLabel } from '@/lib/gigs/display';
import type { ClientRef } from '@/lib/gigs/types';
import type { GigFormValues } from '@/lib/gigs/validation';
import { emptyGigFormState } from '@/lib/gigs/action-state';
import { saveGig } from '../actions';

/**
 * Create/edit form for a gig.
 *
 * Client-side only because it needs `useActionState` to render field errors and
 * the double-booking warning without losing what the user typed. There is no
 * client-side validation: the action is the authority, since it is what a direct
 * POST hits.
 *
 * The "Save anyway" button is a named submit (`name="override" value="1"`), so
 * the override travels in the same FormData as everything else — no client state
 * tracking whether the warning has been acknowledged.
 */
export function GigForm({
  clients,
  initialValues,
  gigId,
  submitLabel,
  cancelHref,
  statusOptions = GIG_STATUSES,
}: {
  clients: ClientRef[];
  initialValues: GigFormValues;
  gigId?: string;
  submitLabel: string;
  cancelHref: `/gigs` | `/gigs?${string}` | `/gigs/${string}`;
  /**
   * On an existing gig, only the current status and its legal next states — the
   * action rejects anything else, so offering the full list would just be a trap.
   */
  statusOptions?: readonly GigStatus[];
}) {
  const [state, formAction, pending] = useActionState(
    saveGig,
    emptyGigFormState(initialValues),
  );

  const values = state.values;
  const errors = state.errors;

  return (
    <form action={formAction} className="space-y-5">
      {gigId ? <input type="hidden" name="gigId" value={gigId} /> : null}

      {state.formError ? <ErrorNote>{state.formError}</ErrorNote> : null}

      {state.phase === 'saved' ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md border border-success/30 bg-success-subtle px-4 py-3 text-sm text-success"
        >
          <Check size={16} aria-hidden="true" />
          Saved.
        </p>
      ) : null}

      {state.warning ? (
        <p
          role="status"
          className="rounded-md border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning"
        >
          {state.warning}
        </p>
      ) : null}

      {state.phase === 'conflict' ? <ConflictWarning state={state} /> : null}

      <Card>
        <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Title"
            htmlFor="gig-title"
            required
            error={errors.title}
            className="sm:col-span-2"
          >
            <Input
              id="gig-title"
              name="title"
              defaultValue={values.title}
              required
              maxLength={200}
              placeholder="Priya & Dev — Willowmere Barn"
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? 'gig-title-error' : undefined}
            />
          </Field>

          <Field label="Shoot type" htmlFor="gig-type" required error={errors.type}>
            <Select id="gig-type" name="type" defaultValue={values.type}>
              {SHOOT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {SHOOT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Status"
            htmlFor="gig-status"
            required
            error={errors.status}
            hint="Held and confirmed gigs are checked for double bookings."
          >
            <Select id="gig-status" name="status" defaultValue={values.status}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {GIG_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Starts" htmlFor="gig-starts-at" required error={errors.startsAt}>
            <Input
              id="gig-starts-at"
              name="startsAt"
              type="datetime-local"
              defaultValue={values.startsAt}
              required
              aria-invalid={errors.startsAt ? true : undefined}
              aria-describedby={errors.startsAt ? 'gig-starts-at-error' : undefined}
            />
          </Field>

          <Field label="Ends" htmlFor="gig-ends-at" required error={errors.endsAt}>
            <Input
              id="gig-ends-at"
              name="endsAt"
              type="datetime-local"
              defaultValue={values.endsAt}
              required
              aria-invalid={errors.endsAt ? true : undefined}
              aria-describedby={errors.endsAt ? 'gig-ends-at-error' : undefined}
            />
          </Field>

          <Field label="Location" htmlFor="gig-location" error={errors.location}>
            <Input
              id="gig-location"
              name="location"
              defaultValue={values.location}
              placeholder="Willowmere Barn, Concord"
            />
          </Field>

          <Field
            label="Client"
            htmlFor="gig-client-id"
            error={errors.clientId}
            hint={
              clients.length === 0
                ? 'No clients on file yet — you can link one later.'
                : undefined
            }
          >
            <Select id="gig-client-id" name="clientId" defaultValue={values.clientId}>
              <option value="">No client linked</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Price"
            htmlFor="gig-price"
            error={errors.price}
            hint="US dollars, e.g. 4200 or 4200.50."
          >
            <Input
              id="gig-price"
              name="price"
              inputMode="decimal"
              defaultValue={values.price}
              placeholder="0.00"
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={errors.price ? 'gig-price-error' : undefined}
            />
          </Field>

          <Field
            label="Deposit"
            htmlFor="gig-deposit"
            error={errors.deposit}
            hint="Cannot be more than the price."
          >
            <Input
              id="gig-deposit"
              name="deposit"
              inputMode="decimal"
              defaultValue={values.deposit}
              placeholder="0.00"
              aria-invalid={errors.deposit ? true : undefined}
              aria-describedby={errors.deposit ? 'gig-deposit-error' : undefined}
            />
          </Field>

          <Field
            label="Notes"
            htmlFor="gig-notes"
            error={errors.notes}
            className="sm:col-span-2"
          >
            <Textarea
              id="gig-notes"
              name="notes"
              defaultValue={values.notes}
              placeholder="Second shooter needed. Ceremony 4pm, golden hour ~7:15pm."
            />
          </Field>
        </CardBody>

        <CardFooter>
          <Link
            href={cancelHref}
            className="inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            Cancel
          </Link>

          {state.phase === 'conflict' ? (
            <Button type="submit" name="override" value="1" variant="danger" disabled={pending}>
              {pending ? 'Saving…' : 'Save anyway'}
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Saving…' : submitLabel}
            </Button>
          )}
        </CardFooter>
      </Card>
    </form>
  );
}

function ConflictWarning({
  state,
}: {
  state: { conflicts: { id: string; title: string; startsAt: string; endsAt: string }[] };
}) {
  return (
    <div
      role="alert"
      className="rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-sm text-warning"
    >
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle size={16} aria-hidden="true" />
        {state.conflicts.length === 1
          ? 'These times overlap another booking'
          : `These times overlap ${state.conflicts.length} other bookings`}
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
            <span className="text-muted"> — {whenLabel(conflict.startsAt, conflict.endsAt)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-muted">
        Nothing has been saved. Adjust the times, or use “Save anyway” if the double
        booking is deliberate — a second shooter, or two sessions close together.
      </p>
    </div>
  );
}
