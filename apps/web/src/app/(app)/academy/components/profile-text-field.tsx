'use client';

import { useActionState, useState } from 'react';
import { Button, ErrorNote, Input, Textarea } from '@/components/ui';
import { IDLE } from '@/lib/academy/action-state';
import { updateBusinessProfileText } from '../profile-actions';

/**
 * One `business_profile` text column, editable in place. Closing the editor
 * is left to the person editing (Cancel/Done) rather than auto-closing on
 * submit — auto-closing on submit would hide a failed save's error message
 * along with the form.
 */
export function ProfileTextField({
  field,
  label,
  value,
  worksheetHref,
  worksheetLabel,
  multiline = true,
}: {
  field: string;
  label: string;
  value: string | null;
  worksheetHref?: string;
  worksheetLabel?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateBusinessProfileText, IDLE);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{label}</h3>
        <button
          type="button"
          onClick={() => setEditing((current) => !current)}
          className="text-xs text-accent hover:underline"
        >
          {editing ? (state.message === 'Saved.' ? 'Done' : 'Cancel') : value ? 'Edit' : 'Add'}
        </button>
      </div>

      {editing ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="field" value={field} />
          {!state.ok && state.message ? <ErrorNote>{state.message}</ErrorNote> : null}
          {multiline ? (
            <Textarea name="value" defaultValue={value ?? ''} rows={3} autoFocus />
          ) : (
            <Input name="value" defaultValue={value ?? ''} autoFocus />
          )}
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
      ) : value ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">{value}</p>
      ) : (
        <p className="text-sm text-faint italic">
          Blank.{' '}
          {worksheetHref ? (
            <a href={worksheetHref} className="text-accent not-italic hover:underline">
              Fill it in via the {worksheetLabel} worksheet
            </a>
          ) : (
            'Add it directly.'
          )}
        </p>
      )}
    </div>
  );
}
