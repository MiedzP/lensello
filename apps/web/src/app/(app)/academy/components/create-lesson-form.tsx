'use client';

import { useActionState } from 'react';
import { Button, ErrorNote, Field, Input, Textarea } from '@/components/ui';
import { IDLE } from '@/lib/academy/action-state';
import { createLesson } from '../actions';

export function CreateLessonForm({ moduleId }: { moduleId: string }) {
  const [state, action, pending] = useActionState(createLesson, IDLE);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="moduleId" value={moduleId} />
      {!state.ok && state.message ? <ErrorNote>{state.message}</ErrorNote> : null}
      {state.ok && state.message ? (
        <p role="status" className="text-xs text-success">
          {state.message}
        </p>
      ) : null}
      <Field label="Title" htmlFor="lesson-title" required>
        <Input id="lesson-title" name="title" required maxLength={150} placeholder="e.g. Writing Meta Descriptions" />
      </Field>
      <Field label="Summary" htmlFor="lesson-summary" hint="One line, shown in the lesson list.">
        <Textarea id="lesson-summary" name="summary" rows={2} maxLength={300} />
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Creating…' : 'Create lesson'}
      </Button>
    </form>
  );
}
