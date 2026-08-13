'use client';

import { useActionState } from 'react';
import { Button, ErrorNote, Select } from '@/components/ui';
import { CLIENT_STAGES, CLIENT_STAGE_LABELS, type ClientStage } from '@lensello/core';
import { setClientStageAction } from '../actions';
import { INITIAL_SIMPLE } from '../form-state';

/** Change the client's funnel stage without leaving the inbox. */
export function StageControl({
  clientId,
  stage,
}: {
  clientId: string;
  stage: ClientStage;
}) {
  const [state, action] = useActionState(setClientStageAction, INITIAL_SIMPLE);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <Select name="stage" key={state.token} defaultValue={stage} className="h-8 text-xs">
        {CLIENT_STAGES.map((value) => (
          <option key={value} value={value}>
            {CLIENT_STAGE_LABELS[value]}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm">
        Update
      </Button>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
    </form>
  );
}
