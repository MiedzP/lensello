'use client';

import { useActionState } from 'react';
import { Button, ErrorNote, Field, Input, Textarea } from '@/components/ui';
import { IDLE } from '@/lib/academy/action-state';
import type { LessonRow } from '@/lib/academy/queries';
import { updateLessonMeta } from '../actions';

export function EditLessonMetaForm({ lesson }: { lesson: LessonRow }) {
  const [state, action, pending] = useActionState(updateLessonMeta, IDLE);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="lessonId" value={lesson.id} />
      {!state.ok && state.message ? <ErrorNote>{state.message}</ErrorNote> : null}
      {state.ok && state.message ? (
        <p role="status" className="text-xs text-success">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label="Title" htmlFor="edit-lesson-title" required>
          <Input id="edit-lesson-title" name="title" defaultValue={lesson.title} required maxLength={150} />
        </Field>
        <Field label="Estimated minutes" htmlFor="edit-lesson-minutes">
          <Input
            id="edit-lesson-minutes"
            name="estimatedMinutes"
            type="number"
            min={1}
            defaultValue={lesson.estimated_minutes ?? ''}
          />
        </Field>
      </div>
      <Field label="Summary" htmlFor="edit-lesson-summary" hint="One line, shown in the lesson list.">
        <Textarea id="edit-lesson-summary" name="summary" defaultValue={lesson.summary ?? ''} rows={2} maxLength={300} />
      </Field>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Saving…' : 'Save details'}
      </Button>
    </form>
  );
}
