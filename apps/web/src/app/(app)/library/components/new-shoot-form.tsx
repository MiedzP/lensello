'use client';

import { useActionState, useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { SHOOT_STATUSES, SHOOT_TYPES, SHOOT_TYPE_LABELS } from '@lensello/core';
import {
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
import { SHOOT_STATUS_LABELS } from '@/lib/library/constants';
import type { ClientOption } from '@/lib/library/queries';
import { createShoot, type ActionResult } from '../actions';

const INITIAL: ActionResult = { ok: false, error: null };

/**
 * "New shoot" disclosure.
 *
 * A plain `<form action={…}>` around a Server Action, so submission works
 * through progressive enhancement; `useActionState` only adds the pending state
 * and the inline error. On success the action redirects to the new shoot, so
 * there is no success branch to render here.
 */
export function NewShootForm({ clients }: { clients: ClientOption[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createShoot, INITIAL);
  const id = useId();

  if (!isOpen) {
    return (
      <div className="mb-5 flex justify-end">
        <Button variant="primary" onClick={() => setIsOpen(true)}>
          <Plus size={16} aria-hidden="true" />
          New shoot
        </Button>
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader
        title="New shoot"
        description="A shoot is the container photos are uploaded into."
        action={
          <Button
            variant="ghost"
            size="sm"
            aria-label="Cancel new shoot"
            onClick={() => setIsOpen(false)}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        }
      />
      <form action={formAction}>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor={`${id}-title`} required className="sm:col-span-2">
            <Input
              id={`${id}-title`}
              name="title"
              required
              maxLength={200}
              placeholder="Ana & Dev — Beacon Hill"
            />
          </Field>

          <Field label="Type" htmlFor={`${id}-type`} required>
            <Select id={`${id}-type`} name="type" defaultValue="portrait" required>
              {SHOOT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {SHOOT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status" htmlFor={`${id}-status`} required>
            <Select id={`${id}-status`} name="status" defaultValue="planned" required>
              {SHOOT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {SHOOT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Shot date" htmlFor={`${id}-shot-at`} hint="Leave blank if unscheduled.">
            <Input id={`${id}-shot-at`} name="shot_at" type="date" />
          </Field>

          <Field label="Location" htmlFor={`${id}-location`}>
            <Input
              id={`${id}-location`}
              name="location"
              maxLength={200}
              placeholder="Boston Public Garden"
            />
          </Field>

          <Field
            label="Client"
            htmlFor={`${id}-client`}
            hint={clients.length === 0 ? 'No clients yet — you can link one later.' : undefined}
            className="sm:col-span-2"
          >
            <Select id={`${id}-client`} name="client_id" defaultValue="">
              <option value="">No client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Notes" htmlFor={`${id}-notes`} className="sm:col-span-2">
            <Textarea id={`${id}-notes`} name="notes" maxLength={2000} />
          </Field>

          {state.error ? (
            <div className="sm:col-span-2">
              <ErrorNote>{state.error}</ErrorNote>
            </div>
          ) : null}
        </CardBody>

        <CardFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Creating…' : 'Create shoot'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
