'use client';

import { useActionState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { CLIENT_STAGE_LABELS, type ClientStage } from '@lensello/core';
import { setClientStageAction } from '../actions';
import { INITIAL_STAGE } from '../form-state';

/**
 * Offers the stage a reply usually moves someone to — offers, does not apply.
 *
 * Advancing the funnel automatically because an email went out would quietly
 * make the pipeline wrong: plenty of replies are "here's the parking
 * information", not "here's your quote".
 */
export function StageOffer({
  clientId,
  stage,
}: {
  clientId: string;
  stage: ClientStage;
}) {
  const [state, action, pending] = useActionState(setClientStageAction, INITIAL_STAGE);
  const applied = state.token > 0 && !state.error;

  if (applied) {
    return (
      <p className="mt-2 text-xs text-success">
        Moved to {CLIENT_STAGE_LABELS[stage]}.
      </p>
    );
  }

  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="stage" value={stage} />
      <Button type="submit" size="sm" disabled={pending}>
        Move to {CLIENT_STAGE_LABELS[stage]}
        <ArrowRight size={13} aria-hidden="true" />
      </Button>
      <span className="text-xs text-muted">Optional — the stage is yours to set.</span>
      {state.error ? (
        <span role="alert" className="text-xs text-danger">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
