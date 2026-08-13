'use client';

import { Button } from '@/components/ui';
import { setEnabledAction } from '../actions';

/**
 * Flipping this to "on" is the one moment a photographer should feel a
 * decision being made — everything else in the builder is reversible and
 * inert until this happens. `window.confirm` only guards the on-switch;
 * turning something off needs no ceremony.
 */
export function EnableToggle({ automationId, enabled }: { automationId: string; enabled: boolean }) {
  return (
    <form
      action={setEnabledAction}
      onSubmit={(event) => {
        if (!enabled && !window.confirm('Turn this automation on? It will start running for real.')) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="automationId" value={automationId} />
      <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
      <Button type="submit" variant={enabled ? 'secondary' : 'primary'}>
        {enabled ? 'Turn off' : 'Turn on'}
      </Button>
    </form>
  );
}
