'use client';

import { useActionState, useState } from 'react';
import { Button, ErrorNote, Select } from '@/components/ui';
import {
  CONVERSATION_STATUSES,
  STATUS_LABELS,
  type ConversationStatus,
} from '@/lib/conversations/channels';
import type { ProfileRow } from '@/lib/conversations/queries';
import { assignConversationAction, setConversationStatusAction } from '../actions';
import { INITIAL_SIMPLE } from '../form-state';

/** Status and assignee, side by side — the two controls that triage a thread. */
export function TriageControls({
  conversationId,
  status,
  assignedTo,
  staff,
}: {
  conversationId: string;
  status: ConversationStatus;
  assignedTo: string | null;
  staff: ProfileRow[];
}) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <StatusForm conversationId={conversationId} status={status} />
      <AssignForm conversationId={conversationId} assignedTo={assignedTo} staff={staff} />
    </div>
  );
}

function StatusForm({
  conversationId,
  status,
}: {
  conversationId: string;
  status: ConversationStatus;
}) {
  const [state, action] = useActionState(setConversationStatusAction, INITIAL_SIMPLE);
  const [pendingStatus, setPendingStatus] = useState(status);
  const showSnoozeDate = pendingStatus === 'snoozed';

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="flex items-center gap-2">
        <Select
          name="status"
          key={state.token}
          defaultValue={status}
          onChange={(event) => setPendingStatus(event.target.value as ConversationStatus)}
          className="h-8 w-32 text-xs"
        >
          {CONVERSATION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
        {showSnoozeDate ? (
          <input
            type="date"
            name="snoozedUntil"
            required
            className="h-8 rounded-md border border-strong bg-surface px-2 text-xs text-foreground"
          />
        ) : (
          <input type="hidden" name="snoozedUntil" value="" />
        )}
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
    </form>
  );
}

function AssignForm({
  conversationId,
  assignedTo,
  staff,
}: {
  conversationId: string;
  assignedTo: string | null;
  staff: ProfileRow[];
}) {
  const [state, action] = useActionState(assignConversationAction, INITIAL_SIMPLE);

  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="flex items-center gap-2">
        <Select
          name="assigneeId"
          key={state.token}
          defaultValue={assignedTo ?? ''}
          className="h-8 w-40 text-xs"
        >
          <option value="">Unassigned</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name || 'Unnamed'}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm">
          Assign
        </Button>
      </div>
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
    </form>
  );
}
