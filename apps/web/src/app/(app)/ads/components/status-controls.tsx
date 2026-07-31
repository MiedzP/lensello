'use client';

import { useActionState } from 'react';
import { Pause, Play, Rocket, Square } from 'lucide-react';
import type { AdStatus } from '@lensello/core';
import { Button, ErrorNote } from '@/components/ui';
import { changeAdStatus, type ActionResult } from '../actions';
import type { AdStatusIntent } from '@/lib/ads/schema';

const INITIAL: ActionResult = { ok: true, message: null };

/**
 * Launch / pause / resume / end.
 *
 * One form, several submit buttons, each carrying its own `intent` via
 * `name`/`value` — so it works without JavaScript and there is a single action
 * to authorize rather than four.
 *
 * Which buttons are offered is derived from the current status, but that is
 * presentation only. The action re-reads the ad and re-checks
 * `ads_active_is_complete` itself, because the button being absent from the page
 * does nothing to stop a direct POST.
 */
export function StatusControls({
  adId,
  status,
  externalId,
}: {
  adId: string;
  status: AdStatus;
  externalId: string | null;
}) {
  const [state, action, pending] = useActionState(changeAdStatus, INITIAL);

  const available = availableIntents(status);

  return (
    <div className="space-y-2">
      {available.length > 0 ? (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="adId" value={adId} />

          {available.map((intent) => (
            <Button
              key={intent}
              type="submit"
              name="intent"
              value={intent}
              variant={intent === 'launch' || intent === 'resume' ? 'primary' : 'secondary'}
              disabled={pending}
            >
              {INTENT_ICONS[intent]}
              {INTENT_LABELS[intent]}
            </Button>
          ))}
        </form>
      ) : (
        <p className="text-sm text-muted">
          This ad has ended. Its numbers stay here for reference.
        </p>
      )}

      {state.ok ? (
        state.message ? (
          <p role="status" aria-live="polite" className="text-xs text-muted">
            {state.message}
          </p>
        ) : null
      ) : (
        <ErrorNote>{state.message}</ErrorNote>
      )}

      <p className="text-xs text-faint">
        {externalId ? (
          <>
            Live on the platform as{' '}
            <code className="rounded bg-surface-raised px-1 py-0.5">
              {externalId}
            </code>
            .
          </>
        ) : (
          'Not yet pushed to a platform. Launching creates it through the ads adapter.'
        )}
      </p>
    </div>
  );
}

const INTENT_LABELS: Record<AdStatusIntent, string> = {
  launch: 'Launch',
  pause: 'Pause',
  resume: 'Resume',
  end: 'End',
};

const INTENT_ICONS: Record<AdStatusIntent, React.ReactNode> = {
  launch: <Rocket size={15} aria-hidden="true" />,
  pause: <Pause size={15} aria-hidden="true" />,
  resume: <Play size={15} aria-hidden="true" />,
  end: <Square size={15} aria-hidden="true" />,
};

function availableIntents(status: AdStatus): AdStatusIntent[] {
  switch (status) {
    case 'draft':
    case 'review':
      return ['launch'];
    case 'active':
      return ['pause', 'end'];
    case 'paused':
      return ['resume', 'end'];
    case 'ended':
      return [];
  }
}
