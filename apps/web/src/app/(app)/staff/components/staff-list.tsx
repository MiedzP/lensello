'use client';

import { useActionState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { IDLE } from '@/lib/staff/action-state';
import { removeAccount } from '../actions';

/**
 * One roster row, pre-formatted on the server.
 *
 * Timestamps arrive as finished strings so `date-fns` stays out of the client
 * bundle, and so relative times are computed once rather than drifting between
 * render and hydration.
 */
export interface StaffRowView {
  id: string;
  fullName: string;
  email: string | null;
  role: 'owner' | 'staff' | null;
  isProvisioned: boolean;
  addedLabel: string;
  signInLabel: string;
  signInExact?: string;
  /** True for the signed-in user's own row. */
  isSelf: boolean;
}

function StaffRow({
  row,
  canRemove,
}: {
  row: StaffRowView;
  canRemove: boolean;
}) {
  const [state, action, pending] = useActionState(removeAccount, IDLE);

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{row.fullName}</span>

          {row.role ? (
            <Badge tone={row.role === 'owner' ? 'accent' : 'neutral'}>{row.role}</Badge>
          ) : (
            <Badge tone="warning">Not provisioned</Badge>
          )}

          {row.isSelf ? <Badge tone="neutral">You</Badge> : null}
        </div>

        <p className="mt-0.5 truncate text-sm text-muted">{row.email ?? 'No email'}</p>

        {!row.isProvisioned ? (
          <p className="mt-1 max-w-prose text-xs text-warning">
            This account can sign in but has no profile, so it can read nothing.
            Remove it, or add a profile row to provision it.
          </p>
        ) : null}

        {state.error ? (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-danger">
            {state.error}
          </p>
        ) : null}

        {state.message ? (
          <p role="status" aria-live="polite" className="mt-1 text-xs text-muted">
            {state.message}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <p className="text-sm text-foreground" title={row.signInExact}>
            {row.signInLabel}
          </p>
          <p className="mt-0.5 text-xs text-faint">{row.addedLabel}</p>
        </div>

        {canRemove && !row.isSelf ? (
          <form action={action}>
            <input type="hidden" name="accountId" value={row.id} />
            <Button type="submit" disabled={pending}>
              <Trash2 size={14} aria-hidden="true" />
              {pending ? 'Removing…' : 'Remove'}
            </Button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

export function StaffList({
  rows,
  canRemove,
}: {
  rows: StaffRowView[];
  canRemove: boolean;
}) {
  return (
    <ul className="divide-y divide-subtle">
      {rows.map((row) => (
        <StaffRow key={row.id} row={row} canRemove={canRemove} />
      ))}
    </ul>
  );
}
