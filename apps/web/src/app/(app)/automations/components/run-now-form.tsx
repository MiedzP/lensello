'use client';

import { useActionState } from 'react';
import { Button, Card, CardBody, CardFooter, CardHeader, ErrorNote, Field, Input } from '@/components/ui';
import { IDLE } from '@/lib/automations/action-state';
import { runNowAction } from '../actions';

/**
 * Runs the real thing, right now — the same runner an event or a schedule
 * would use, with the same rate limit and loop guard. Requires the
 * automation's own name typed back, the same friction the clients module
 * uses before erasing a record, because this can be just as irreversible:
 * once an email is sent, this form cannot un-send it.
 */
export function RunNowForm({ automationId, automationName, enabled }: { automationId: string; automationName: string; enabled: boolean }) {
  const [state, action, pending] = useActionState(runNowAction, IDLE);

  return (
    <Card>
      <CardHeader
        title="Run now"
        description={
          enabled
            ? 'Executes every step for real — real emails, real messages. Optionally scope it to one client.'
            : 'Turn the automation on first. A disabled automation stays off on purpose, including here.'
        }
      />
      <form action={action}>
        <input type="hidden" name="automationId" value={automationId} />
        <CardBody className="space-y-4">
          {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

          <Field label="Client id" htmlFor="clientId" hint="Optional — leave blank for triggers that don't need one.">
            <Input id="clientId" name="clientId" disabled={!enabled} placeholder="uuid" />
          </Field>

          <Field label={`Type "${automationName}" to confirm`} htmlFor="confirm" required>
            <Input id="confirm" name="confirm" disabled={!enabled} required />
          </Field>
        </CardBody>
        <CardFooter className="justify-between">
          <p className="text-xs text-muted" aria-live="polite">
            {state.message ?? ''}
          </p>
          <Button type="submit" variant="danger" disabled={!enabled || pending}>
            {pending ? 'Running…' : 'Run now'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
