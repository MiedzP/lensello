'use client';

import { useActionState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
import { INITIAL_SYNC, syncInboxAction } from '../actions';

/**
 * Pulls inbound mail through the Gmail adapter.
 *
 * A form rather than an onClick handler, so it still submits before hydration.
 * The result line always says something — "No new messages." is the correct,
 * reassuring answer, and a button that appears to do nothing is worse than one
 * that tells you it did nothing.
 */
export function SyncInboxButton({ compact = false }: { compact?: boolean }) {
  const [state, action, pending] = useActionState(syncInboxAction, INITIAL_SYNC);

  return (
    <div className={compact ? 'flex flex-col items-center gap-2' : 'flex flex-col items-end gap-2'}>
      <form action={action}>
        <Button type="submit" variant="primary" disabled={pending}>
          <RefreshCw
            size={15}
            aria-hidden="true"
            className={pending ? 'animate-spin' : undefined}
          />
          {pending ? 'Syncing…' : 'Sync inbox'}
        </Button>
      </form>

      <p
        aria-live="polite"
        className={
          state.error
            ? 'max-w-xs text-xs text-danger'
            : 'max-w-xs text-xs text-muted'
        }
      >
        {state.error ?? state.summary ?? ''}
      </p>
    </div>
  );
}
