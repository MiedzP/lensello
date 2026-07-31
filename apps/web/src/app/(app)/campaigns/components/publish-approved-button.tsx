'use client';

import { useActionState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button, ErrorNote } from '@/components/ui';
import { IDLE } from '@/lib/campaigns/action-state';
import { publishApprovedPosts } from '../actions';

/**
 * Bulk publish.
 *
 * The action publishes every approved post even if one fails, so the result is
 * a per-post report rather than a single success/failure — that is what gets
 * rendered here.
 */
export function PublishApprovedButton({
  campaignId,
  approvedCount,
}: {
  campaignId: string;
  approvedCount: number;
}) {
  const [state, action, pending] = useActionState(publishApprovedPosts, IDLE);

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="campaignId" value={campaignId} />
        <Button
          type="submit"
          variant="primary"
          disabled={pending || approvedCount === 0}
          title={
            approvedCount === 0
              ? 'Approve at least one post to publish it'
              : undefined
          }
        >
          {pending ? (
            <>
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              Publishing {approvedCount}…
            </>
          ) : (
            <>
              <Send size={15} aria-hidden="true" />
              Publish {approvedCount} approved
            </>
          )}
        </Button>
      </form>

      {state.error ? (
        <ErrorNote>
          <span className="whitespace-pre-line">{state.error}</span>
        </ErrorNote>
      ) : null}
      {!state.error && state.message ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
