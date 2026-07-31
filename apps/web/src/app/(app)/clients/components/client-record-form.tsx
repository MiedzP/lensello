'use client';

import { useActionState } from 'react';
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
import {
  CLIENT_SOURCES,
  CLIENT_STAGES,
  CLIENT_STAGE_LABELS,
} from '@lensello/core';
import type { ClientRow } from '@/lib/clients/queries';
import { CLIENT_SOURCE_LABELS } from '@/lib/clients/stages';
import { INITIAL_RECORD, updateClientAction } from '../actions';

/** The editable client record. */
export function ClientRecordForm({ client }: { client: ClientRow }) {
  const [state, action, pending] = useActionState(updateClientAction, INITIAL_RECORD);

  return (
    <Card>
      <CardHeader
        title="Client record"
        description="Everything here is yours to correct — including a stage or source that sync guessed."
      />
      <form action={action}>
        <CardBody className="space-y-4">
          {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

          <input type="hidden" name="clientId" value={client.id} />

          <Field label="Name" htmlFor="name" required>
            <Input
              id="name"
              name="name"
              defaultValue={client.name}
              maxLength={200}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Email"
              htmlFor="email"
              hint="Used to match inbound mail, and to send replies."
            >
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={client.email ?? ''}
                maxLength={320}
                autoComplete="off"
              />
            </Field>

            <Field label="Phone" htmlFor="phone">
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={client.phone ?? ''}
                maxLength={40}
                autoComplete="off"
              />
            </Field>

            <Field label="Stage" htmlFor="stage" required>
              <Select id="stage" name="stage" defaultValue={client.stage}>
                {CLIENT_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {CLIENT_STAGE_LABELS[stage]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Source" htmlFor="source" required>
              <Select id="source" name="source" defaultValue={client.source}>
                {CLIENT_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {CLIENT_SOURCE_LABELS[source]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Notes"
            htmlFor="notes"
            hint="Private to the studio. Never sent to the client or given to the AI as a fact."
          >
            <Textarea
              id="notes"
              name="notes"
              defaultValue={client.notes ?? ''}
              maxLength={5000}
              placeholder="Venue quirks, who the decision maker is, anything you'll want next time."
            />
          </Field>
        </CardBody>

        <CardFooter>
          <span aria-live="polite" className="mr-auto text-xs text-success">
            {state.saved && !state.error ? 'Saved.' : ''}
          </span>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save record'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
