'use client';

import { useActionState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { DEFAULT_SYNC_WINDOW_DAYS, SYNC_WINDOW_DAYS } from '@/lib/ads/constants';
import { syncPerformance, type ActionResult } from '../actions';

const INITIAL: ActionResult = { ok: true, message: null };

/**
 * "Sync performance" — pulls daily numbers from the ad platform.
 *
 * A real form posting to the action, so it works before hydration; the client
 * boundary exists only to show pending state and the result sentence. Re-running
 * it over a window already synced is safe: the action upserts on
 * `(ad_id, day)`, so overlapping days are updated rather than duplicated.
 */
export function SyncForm({
  adId,
  label = 'Sync performance',
}: {
  /** Omit to sync every launched ad. */
  adId?: string;
  label?: string;
}) {
  const [state, action, pending] = useActionState(syncPerformance, INITIAL);
  const selectId = adId ? `sync-days-${adId}` : 'sync-days-all';

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <form action={action} className="flex items-end gap-2">
        {adId ? <input type="hidden" name="adId" value={adId} /> : null}

        <div className="space-y-1.5">
          <label htmlFor={selectId} className="block text-xs font-medium text-muted">
            Window
          </label>
          <Select
            id={selectId}
            name="days"
            defaultValue={String(DEFAULT_SYNC_WINDOW_DAYS)}
            className="w-32"
            disabled={pending}
          >
            {SYNC_WINDOW_DAYS.map((days) => (
              <option key={days} value={days}>
                Last {days} days
              </option>
            ))}
          </Select>
        </div>

        <Button type="submit" disabled={pending}>
          <RefreshCw
            size={14}
            aria-hidden="true"
            className={pending ? 'animate-spin' : undefined}
          />
          {pending ? 'Syncing…' : label}
        </Button>
      </form>

      {state.message ? (
        <p
          // Politely announced: the result is useful but not urgent, and an
          // assertive live region would interrupt whatever is being read.
          role="status"
          aria-live="polite"
          className={
            state.ok
              ? 'max-w-xs text-xs text-muted sm:text-right'
              : 'max-w-xs text-xs text-danger sm:text-right'
          }
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
