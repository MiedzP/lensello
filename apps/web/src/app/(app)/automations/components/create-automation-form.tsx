'use client';

import { Button, Card, CardBody, CardFooter, Field, Input, Select, Textarea } from '@/components/ui';
import { TRIGGER_DESCRIPTIONS, TRIGGER_KINDS, TRIGGER_LABELS } from '@/lib/automations/types';
import { createAutomationAction } from '../actions';

export function CreateAutomationForm() {
  return (
    <form action={createAutomationAction} className="space-y-4">
      <Card>
        <CardBody className="space-y-4">
          <Field label="Name" htmlFor="name" required hint="Something you'll recognise in a list of a dozen of these.">
            <Input id="name" name="name" maxLength={120} placeholder="Thank the client after a wedding" required />
          </Field>

          <Field label="Description" htmlFor="description" hint="Optional — a reminder to your future self.">
            <Textarea id="description" name="description" maxLength={500} rows={2} />
          </Field>

          <Field
            label="Starts when…"
            htmlFor="triggerKind"
            required
            hint="You can fine-tune the filter for this trigger on the next screen."
          >
            <Select id="triggerKind" name="triggerKind" defaultValue={TRIGGER_KINDS[0]}>
              {TRIGGER_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {TRIGGER_LABELS[kind]}
                </option>
              ))}
            </Select>
          </Field>

          <TriggerHelpText />
        </CardBody>

        <CardFooter className="justify-between">
          <p className="text-xs text-muted">
            Created switched off. You&apos;ll add steps and turn it on from the next screen.
          </p>
          <Button type="submit" variant="primary">
            Continue
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

/** Static help text under the select — a live description would need client state for one field; not worth it. */
function TriggerHelpText() {
  return (
    <ul className="space-y-1 text-xs text-muted">
      {TRIGGER_KINDS.map((kind) => (
        <li key={kind}>
          <span className="font-medium text-foreground">{TRIGGER_LABELS[kind]}:</span> {TRIGGER_DESCRIPTIONS[kind]}
        </li>
      ))}
    </ul>
  );
}
