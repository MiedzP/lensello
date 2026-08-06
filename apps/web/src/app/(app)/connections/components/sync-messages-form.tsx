'use client';

import { useActionState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
import { IDLE } from '@/lib/connections/action-state';
import { syncMessages } from '../actions';

/**
 * "Collect messages" — pulls DMs, comments, and mentions from every linked
 * account and files them against clients.
 *
 * A real form posting to the action, so it works before hydration; the client
 * boundary exists only for pending state and the result sentence. Pressing it
 * twice is safe — the sync upserts on `messages.external_id`.
 */
export function SyncMessagesForm({
  platform,
  label = 'Collect messages',
}: {
  /** Omit to collect from every linked account that can supply messages. */
  platform?: string;
  label?: string;
}) {
  const [state, action, pending] = useActionState(syncMessages, IDLE);

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <form action={action}>
        {platform ? <input type="hidden" name="platform" value={platform} /> : null}

        <Button type="submit" disabled={pending}>
          <RefreshCw
            size={14}
            aria-hidden="true"
            className={pending ? 'animate-spin' : undefined}
          />
          {pending ? 'Collecting…' : label}
        </Button>
      </form>

      {state.message ? (
        <p
          role="status"
          aria-live="polite"
          className="max-w-sm text-xs text-muted sm:text-right"
        >
          {state.message}
        </p>
      ) : null}

      {state.error ? (
        <p
          role="status"
          aria-live="polite"
          className="max-w-sm text-xs text-danger sm:text-right"
        >
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
