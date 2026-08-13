'use client';

import { useActionState } from 'react';
import { Button, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui';
import { IDLE } from '@/lib/academy/action-state';
import { createResource } from '../actions';

const KIND_OPTIONS = [
  { value: 'link', label: 'Link' },
  { value: 'template', label: 'Template' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'download', label: 'Download' },
  { value: 'video', label: 'Video' },
  { value: 'community', label: 'Community' },
] as const;

/** `ownerId` belongs to exactly one of a module or a lesson — the same rule
 * the database enforces with a check constraint. */
export function ResourceForm({
  moduleId,
  lessonId,
}: {
  moduleId?: string;
  lessonId?: string;
}) {
  const [state, action, pending] = useActionState(createResource, IDLE);

  return (
    <form action={action} className="space-y-3">
      {moduleId ? <input type="hidden" name="moduleId" value={moduleId} /> : null}
      {lessonId ? <input type="hidden" name="lessonId" value={lessonId} /> : null}

      {!state.ok && state.message ? <ErrorNote>{state.message}</ErrorNote> : null}

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label="Title" htmlFor="resource-title" required>
          <Input id="resource-title" name="title" required maxLength={150} />
        </Field>
        <Field label="Kind" htmlFor="resource-kind">
          <Select id="resource-kind" name="kind" defaultValue="link">
            {KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="URL" htmlFor="resource-url" hint="Where this lives — a doc, a template, the community page.">
        <Input id="resource-url" name="url" type="url" placeholder="https://…" />
      </Field>

      <Field label="Description" htmlFor="resource-description">
        <Textarea id="resource-description" name="description" rows={2} maxLength={300} />
      </Field>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Adding…' : 'Add resource'}
      </Button>
    </form>
  );
}
