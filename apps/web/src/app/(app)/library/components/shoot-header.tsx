'use client';

import { useActionState, useId, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Pencil, Star, User } from 'lucide-react';
import { SHOOT_STATUSES, SHOOT_TYPES, SHOOT_TYPE_LABELS } from '@lensello/core';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  ErrorNote,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import type { Tables } from '@/lib/db.types';
import { pluralize } from '@/lib/utils';
import {
  SHOOT_STATUS_LABELS,
  SHOOT_STATUS_TONES,
  formatDate,
  toDateInputValue,
} from '@/lib/library/constants';
import type { ClientOption } from '@/lib/library/queries';
import { updateShoot, type ActionResult } from '../actions';

const INITIAL: ActionResult = { ok: false, error: null };

/**
 * Shoot metadata, editable in place.
 *
 * Read mode is the default and stays compact; "Edit details" swaps in the same
 * fields the create form uses, submitted to `updateShoot`.
 */
export function ShootHeader({
  shoot,
  clientName,
  clients,
  assetCount,
  selectCount,
}: {
  shoot: Tables<'shoots'>;
  clientName: string | null;
  clients: ClientOption[];
  assetCount: number;
  selectCount: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const id = useId();

  // Closing the editor happens in the action itself, not in an effect watching
  // `state.ok`: the action already knows the write succeeded, and an effect
  // would re-render the whole header a second time to find that out.
  const [state, formAction, pending] = useActionState(
    async (previous: ActionResult, formData: FormData) => {
      const result = await updateShoot(previous, formData);
      if (result.ok) setIsEditing(false);
      return result;
    },
    INITIAL,
  );

  const shotOn = formatDate(shoot.shot_at);

  return (
    <div className="mb-6">
      <Link
        href="/library"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        All shoots
      </Link>

      {isEditing ? (
        <Card>
          <CardHeader title="Edit shoot details" />
          <form action={formAction}>
            <input type="hidden" name="shoot_id" value={shoot.id} />

            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor={`${id}-title`} required className="sm:col-span-2">
                <Input
                  id={`${id}-title`}
                  name="title"
                  required
                  maxLength={200}
                  defaultValue={shoot.title}
                />
              </Field>

              <Field label="Type" htmlFor={`${id}-type`} required>
                <Select id={`${id}-type`} name="type" defaultValue={shoot.type} required>
                  {SHOOT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {SHOOT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Status" htmlFor={`${id}-status`} required>
                <Select id={`${id}-status`} name="status" defaultValue={shoot.status} required>
                  {SHOOT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {SHOOT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Shot date" htmlFor={`${id}-shot-at`}>
                <Input
                  id={`${id}-shot-at`}
                  name="shot_at"
                  type="date"
                  defaultValue={toDateInputValue(shoot.shot_at)}
                />
              </Field>

              <Field label="Location" htmlFor={`${id}-location`}>
                <Input
                  id={`${id}-location`}
                  name="location"
                  maxLength={200}
                  defaultValue={shoot.location ?? ''}
                />
              </Field>

              <Field label="Client" htmlFor={`${id}-client`} className="sm:col-span-2">
                <Select
                  id={`${id}-client`}
                  name="client_id"
                  defaultValue={shoot.client_id ?? ''}
                >
                  <option value="">No client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Notes" htmlFor={`${id}-notes`} className="sm:col-span-2">
                <Textarea
                  id={`${id}-notes`}
                  name="notes"
                  maxLength={2000}
                  defaultValue={shoot.notes ?? ''}
                />
              </Field>

              {state.error ? (
                <div className="sm:col-span-2">
                  <ErrorNote>{state.error}</ErrorNote>
                </div>
              ) : null}
            </CardBody>

            <CardFooter>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? 'Saving…' : 'Save details'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {shoot.title}
              </h1>
              <Badge tone={SHOOT_STATUS_TONES[shoot.status]}>
                {SHOOT_STATUS_LABELS[shoot.status]}
              </Badge>
            </div>

            <p className="mt-1 text-sm text-muted">
              {SHOOT_TYPE_LABELS[shoot.type]}
              {shotOn ? ` · ${shotOn}` : ' · No shot date'}
              {` · ${pluralize(assetCount, 'photo')}`}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
              {clientName ? (
                <span className="inline-flex items-center gap-1">
                  <User size={12} aria-hidden="true" />
                  {clientName}
                </span>
              ) : null}
              {shoot.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} aria-hidden="true" />
                  {shoot.location}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Star size={12} aria-hidden="true" />
                {pluralize(selectCount, 'select')}
              </span>
            </div>

            {shoot.notes ? (
              <p className="mt-3 max-w-prose text-sm whitespace-pre-line text-muted">
                {shoot.notes}
              </p>
            ) : null}
          </div>

          <Button onClick={() => setIsEditing(true)}>
            <Pencil size={15} aria-hidden="true" />
            Edit details
          </Button>
        </div>
      )}
    </div>
  );
}
