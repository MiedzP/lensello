'use client';

import { useActionState, useState } from 'react';
import { Button, ErrorNote, Input, Textarea } from '@/components/ui';
import { IDLE } from '@/lib/academy/action-state';
import { updateBusinessProfileJourney } from '../profile-actions';

export interface JourneyStage {
  stage: string;
  touchpoints: string;
}

let nextRowId = 0;

export function ProfileJourneyEditor({
  value,
  worksheetHref,
}: {
  value: JourneyStage[] | null;
  worksheetHref?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Array<{ id: number; stage: string; touchpoints: string }>>(
    () => (value ?? []).map((stage) => ({ id: nextRowId++, ...stage })),
  );
  const [state, action, pending] = useActionState(updateBusinessProfileJourney, IDLE);

  function startEditing() {
    setRows(
      (value ?? []).length > 0
        ? (value ?? []).map((stage) => ({ id: nextRowId++, ...stage }))
        : [{ id: nextRowId++, stage: '', touchpoints: '' }],
    );
    setEditing(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {worksheetHref ? (
            <>
              From the customer journey worksheet. <a href={worksheetHref} className="text-accent hover:underline">Open it</a> to redo the exercise, or edit directly below.
            </>
          ) : (
            'Filled in via the customer journey worksheet, or directly below.'
          )}
        </p>
        {editing ? (
          <button type="button" onClick={() => setEditing(false)} className="shrink-0 text-xs text-accent hover:underline">
            Cancel
          </button>
        ) : (
          <button type="button" onClick={startEditing} className="shrink-0 text-xs text-accent hover:underline">
            {value && value.length > 0 ? 'Edit' : 'Add'}
          </button>
        )}
      </div>

      {editing ? (
        <form action={action} className="space-y-3">
          {!state.ok && state.message ? <ErrorNote>{state.message}</ErrorNote> : null}
          <ol className="space-y-3">
            {rows.map((row, index) => (
              <li key={row.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-start">
                <Input
                  name="stage"
                  defaultValue={row.stage}
                  placeholder={`Stage ${index + 1}, e.g. "Awareness"`}
                  aria-label={`Stage ${index + 1} name`}
                />
                <Textarea
                  name="touchpoints"
                  defaultValue={row.touchpoints}
                  rows={2}
                  placeholder="What the client sees and experiences here"
                  aria-label={`Stage ${index + 1} touchpoints`}
                />
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
                  className="justify-self-start text-xs text-muted hover:text-danger sm:mt-2"
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => setRows((current) => [...current, { id: nextRowId++, stage: '', touchpoints: '' }])}
            className="text-xs font-medium text-accent hover:underline"
          >
            + Add a stage
          </button>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" variant="primary" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            {state.ok && state.message ? (
              <span className="text-xs text-success" role="status">
                {state.message}
              </span>
            ) : null}
          </div>
        </form>
      ) : value && value.length > 0 ? (
        <ol className="space-y-2">
          {value.map((stage, index) => (
            <li key={index} className="rounded-md border border-subtle bg-surface px-3 py-2">
              <p className="text-sm font-medium text-foreground">
                {index + 1}. {stage.stage || 'Untitled stage'}
              </p>
              <p className="mt-0.5 text-sm text-muted whitespace-pre-wrap">
                {stage.touchpoints || <span className="italic text-faint">No touchpoints written yet.</span>}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-faint italic">Blank.</p>
      )}
    </div>
  );
}
