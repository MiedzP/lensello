'use client';

import { useActionState } from 'react';
import { Button, Card, CardBody, CardFooter, ErrorNote, Field, Input, Textarea } from '@/components/ui';
import { IDLE } from '@/lib/automations/action-state';
import type { Automation } from '@/lib/automations/types';
import { updateAutomationAction } from '../actions';

export function AutomationSettingsForm({ automation }: { automation: Automation }) {
  const [state, action, pending] = useActionState(updateAutomationAction, IDLE);

  return (
    <form action={action}>
      <input type="hidden" name="automationId" value={automation.id} />
      <Card>
        <CardBody className="space-y-4">
          {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

          <Field label="Name" htmlFor="name" required>
            <Input id="name" name="name" maxLength={120} defaultValue={automation.name} required />
          </Field>

          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" rows={2} maxLength={500} defaultValue={automation.description ?? ''} />
          </Field>

          <Field
            label="Max runs per day"
            htmlFor="maxRunsPerDay"
            hint="Enforced before any step runs. Leave blank for no limit — not recommended for anything that emails a client."
          >
            <Input
              id="maxRunsPerDay"
              name="maxRunsPerDay"
              type="number"
              min={1}
              max={1000}
              defaultValue={automation.max_runs_per_day ?? ''}
            />
          </Field>
        </CardBody>
        <CardFooter className="justify-between">
          <p className="text-xs text-muted" aria-live="polite">
            {state.message ?? ''}
          </p>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
