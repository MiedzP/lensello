'use client';

import { useActionState } from 'react';
import { Button, ErrorNote, Field, Input, Textarea } from '@/components/ui';
import { IDLE } from '@/lib/academy/action-state';
import { createModule } from '../actions';

export function CreateModuleForm() {
  const [state, action, pending] = useActionState(createModule, IDLE);

  return (
    <form action={action} className="space-y-4">
      {!state.ok && state.message ? <ErrorNote>{state.message}</ErrorNote> : null}
      {state.ok && state.message ? (
        <p role="status" className="text-xs text-success">
          {state.message}
        </p>
      ) : null}
      <Field label="Title" htmlFor="module-title" required>
        <Input id="module-title" name="title" required maxLength={120} placeholder="e.g. Email Marketing" />
      </Field>
      <Field label="Summary" htmlFor="module-summary" hint="One line, shown on the academy home page.">
        <Textarea id="module-summary" name="summary" rows={2} maxLength={300} />
      </Field>
      <Field
        label="Icon"
        htmlFor="module-icon"
        hint="A lucide-react icon name (e.g. Search, Target, Route). Leave blank for a default."
      >
        <Input id="module-icon" name="icon" maxLength={60} />
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Creating…' : 'Create module'}
      </Button>
    </form>
  );
}
