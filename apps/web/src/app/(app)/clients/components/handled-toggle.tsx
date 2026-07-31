'use client';

import { useActionState } from 'react';
import { Check, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { INITIAL_HANDLED, setMessageHandledAction } from '../actions';

/** Ticks an inbound message off the queue, or puts it back on. */
export function HandledToggle({
  clientId,
  messageId,
  isHandled,
}: {
  clientId: string;
  messageId: string;
  isHandled: boolean;
}) {
  const [state, action, pending] = useActionState(
    setMessageHandledAction,
    INITIAL_HANDLED,
  );

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="messageId" value={messageId} />
      {/* The button posts the value it wants rather than toggling server-side,
          so a double submit is idempotent instead of flip-flopping. */}
      <input type="hidden" name="isHandled" value={isHandled ? 'false' : 'true'} />

      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {isHandled ? (
          <>
            <Undo2 size={13} aria-hidden="true" />
            Needs a reply
          </>
        ) : (
          <>
            <Check size={13} aria-hidden="true" />
            Mark handled
          </>
        )}
      </Button>

      {state.error ? (
        <span role="alert" className="text-xs text-danger">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
