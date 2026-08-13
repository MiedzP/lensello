'use client';

import { useActionState } from 'react';
import { Button, ErrorNote, Field, Input, Textarea } from '@/components/ui';
import { IDLE } from '@/lib/academy/action-state';
import type { ModuleRow } from '@/lib/academy/queries';
import { deleteModule, updateModule } from '../actions';

export function EditModuleForm({ module: mod }: { module: ModuleRow }) {
  const [state, action, pending] = useActionState(updateModule, IDLE);

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="moduleId" value={mod.id} />
        {!state.ok && state.message ? <ErrorNote>{state.message}</ErrorNote> : null}
        {state.ok && state.message ? (
          <p role="status" className="text-xs text-success">
            {state.message}
          </p>
        ) : null}

        <Field label="Title" htmlFor="edit-module-title" required>
          <Input id="edit-module-title" name="title" defaultValue={mod.title} required maxLength={120} />
        </Field>
        <Field label="Summary" htmlFor="edit-module-summary">
          <Textarea id="edit-module-summary" name="summary" defaultValue={mod.summary ?? ''} rows={2} maxLength={300} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Icon" htmlFor="edit-module-icon" hint="A lucide-react icon name.">
            <Input id="edit-module-icon" name="icon" defaultValue={mod.icon ?? ''} maxLength={60} />
          </Field>
          <Field label="Accent color" htmlFor="edit-module-accent" hint="A hex color, e.g. #4f46e5.">
            <Input id="edit-module-accent" name="accentColor" defaultValue={mod.accent_color ?? ''} maxLength={7} placeholder="#4f46e5" />
          </Field>
        </div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>

      <form
        action={deleteModule}
        className="rounded-md border border-danger/30 bg-danger-subtle p-4"
      >
        <input type="hidden" name="moduleId" value={mod.id} />
        <p className="text-sm font-medium text-danger">Delete this module</p>
        <p className="mt-1 text-xs text-danger">
          Deletes every lesson, resource, and worksheet inside it. This cannot be undone.
        </p>
        <Button type="submit" variant="danger" size="sm" className="mt-3">
          Delete module
        </Button>
      </form>
    </div>
  );
}
