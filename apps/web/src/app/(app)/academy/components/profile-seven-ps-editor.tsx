'use client';

import { useActionState, useState } from 'react';
import { Button, ErrorNote, Textarea } from '@/components/ui';
import { IDLE } from '@/lib/academy/action-state';
import { updateBusinessProfileSevenPs } from '../profile-actions';

export type SevenPsValue = Partial<Record<string, string>>;

const PS: Array<{ key: string; label: string }> = [
  { key: 'product', label: 'Product' },
  { key: 'price', label: 'Price' },
  { key: 'place', label: 'Place' },
  { key: 'promotion', label: 'Promotion' },
  { key: 'people', label: 'People' },
  { key: 'process', label: 'Process' },
  { key: 'physical_evidence', label: 'Physical Evidence' },
];

export function ProfileSevenPsEditor({
  value,
  worksheetHref,
}: {
  value: SevenPsValue | null;
  worksheetHref?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateBusinessProfileSevenPs, IDLE);
  const hasAny = PS.some((p) => (value?.[p.key]?.trim().length ?? 0) > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {worksheetHref ? (
            <>
              From the 7 Ps worksheet. <a href={worksheetHref} className="text-accent hover:underline">Open it</a> to redo the exercise, or edit directly below.
            </>
          ) : (
            'Filled in via the 7 Ps worksheet, or directly below.'
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
            {PS.map((p) => (
              <div key={p.key} className="space-y-1">
                <label htmlFor={`seven-ps-${p.key}`} className="text-xs font-medium text-foreground">
                  {p.label}
                </label>
                <Textarea id={`seven-ps-${p.key}`} name={p.key} rows={2} defaultValue={value?.[p.key] ?? ''} />
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
        <dl className="grid gap-3 sm:grid-cols-2">
          {PS.map((p) => (
            <div key={p.key}>
              <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{p.label}</dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {value?.[p.key]?.trim() ? value[p.key] : <span className="text-faint italic">Blank.</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
