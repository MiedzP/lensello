'use client';

import { useActionState, useState } from 'react';
import { Button, ErrorNote, Textarea } from '@/components/ui';
import { IDLE } from '@/lib/academy/action-state';
import { updateBusinessProfileSwot } from '../profile-actions';

export interface SwotValue {
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  threats?: string[];
}

const QUADRANTS: Array<{ key: keyof SwotValue; label: string }> = [
  { key: 'strengths', label: 'Strengths' },
  { key: 'weaknesses', label: 'Weaknesses' },
  { key: 'opportunities', label: 'Opportunities' },
  { key: 'threats', label: 'Threats' },
];

function List({ items }: { items: string[] | undefined }) {
  if (!items || items.length === 0) return <p className="text-sm text-faint italic">Blank.</p>;
  return (
    <ul className="ml-4 list-disc space-y-0.5 text-sm text-foreground">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function ProfileSwotEditor({
  value,
  worksheetHref,
}: {
  value: SwotValue | null;
  worksheetHref?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateBusinessProfileSwot, IDLE);
  const hasAny = QUADRANTS.some((q) => (value?.[q.key]?.length ?? 0) > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {worksheetHref ? (
            <>
              From the SWOT worksheet. <a href={worksheetHref} className="text-accent hover:underline">Open it</a> to redo the exercise, or edit directly below.
            </>
          ) : (
            'Filled in via the SWOT worksheet, or directly below.'
          )}
        </p>
        <button type="button" onClick={() => setEditing((v) => !v)} className="shrink-0 text-xs text-accent hover:underline">
          {editing ? 'Cancel' : hasAny ? 'Edit' : 'Add'}
        </button>
      </div>

      {editing ? (
        <form action={action} className="space-y-3">
          {!state.ok && state.message ? <ErrorNote>{state.message}</ErrorNote> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {QUADRANTS.map((quadrant) => (
              <div key={quadrant.key} className="space-y-1">
                <label htmlFor={quadrant.key} className="text-xs font-medium text-foreground">
                  {quadrant.label}
                </label>
                <Textarea
                  id={quadrant.key}
                  name={quadrant.key}
                  rows={4}
                  placeholder="One per line"
                  defaultValue={(value?.[quadrant.key] ?? []).join('\n')}
                />
              </div>
            ))}
          </div>
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {QUADRANTS.map((quadrant) => (
            <div key={quadrant.key}>
              <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">{quadrant.label}</h4>
              <div className="mt-1">
                <List items={value?.[quadrant.key]} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
