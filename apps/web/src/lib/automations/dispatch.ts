/**
 * The hook other modules could call. **This is the piece that is not wired
 * in yet** — see the build report for the exact call sites. Until a write
 * path calls this, its matching event-driven automations simply never fire,
 * which is a safe default but not a useful one.
 *
 * Payload contract (all optional, all a plain object because `jsonb` has no
 * schema of its own):
 *
 *   { clientId?: string; gigId?: string; galleryId?: string;
 *     toStage?: string; fromStage?: string; channel?: string;
 *     isFirstView?: boolean; [key: string]: unknown }
 *
 * `clientId` / `gigId` / `galleryId` are resolved into full rows by
 * `buildRunContext`. The rest are trigger-specific filter inputs a step or
 * the matcher below reads directly from the payload — computed by the call
 * site, because only the call site knows them cheaply (e.g. "was this the
 * first view of this gallery" is a count the gallery route already has to do
 * the insert; recomputing it here would be a second query for information
 * the caller already had).
 */

import type { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/db.types';
import { runAutomation, type RunOutcome } from './runner';
import type { Automation, TriggerKind } from './types';
import { DISPATCHABLE_TRIGGERS } from './types';

type Admin = ReturnType<typeof createAdminClient>;
export type DispatchableTriggerKind = (typeof DISPATCHABLE_TRIGGERS)[number];

export interface DispatchInput {
  triggerKind: DispatchableTriggerKind;
  payload: Record<string, unknown>;
  /** Present only when this dispatch is itself caused by another automation's step. */
  chain?: string[];
}

function readString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Trigger-level filters, read straight off the payload — see the module
 * comment. A filter with nothing to check against (an unset `toStage`, an
 * "any" channel) always matches; that is what makes filtering opt-in.
 */
function matchesFilter(automation: Pick<Automation, 'trigger_kind' | 'trigger_config'>, payload: Record<string, unknown>): boolean {
  const config = (automation.trigger_config ?? {}) as Record<string, unknown>;

  switch (automation.trigger_kind) {
    case 'message_received': {
      const channel = config.channel;
      if (!channel || channel === 'any') return true;
      return readString(payload, 'channel') === channel;
    }
    case 'client_stage_changed': {
      const toStage = config.toStage;
      if (!toStage || toStage === 'any') return true;
      return readString(payload, 'toStage') === toStage;
    }
    case 'gig_booked': {
      const gigType = config.gigType;
      if (!gigType || gigType === 'any') return true;
      return readString(payload, 'gigType') === gigType;
    }
    case 'gallery_viewed': {
      const onlyFirstView = config.onlyFirstView !== false;
      if (!onlyFirstView) return true;
      return payload.isFirstView !== false;
    }
    default:
      return true;
  }
}

export async function dispatchAutomationEvent(
  admin: Admin,
  input: DispatchInput,
): Promise<RunOutcome[]> {
  const { data: candidates, error } = await admin
    .from('automations')
    .select('*')
    .eq('trigger_kind', input.triggerKind)
    .eq('enabled', true);

  if (error) {
    console.error('[automations] dispatch could not load candidates', input.triggerKind, error);
    return [];
  }

  const outcomes: RunOutcome[] = [];

  for (const automation of candidates ?? []) {
    if (!matchesFilter(automation, input.payload)) {
      const { data } = await admin
        .from('automation_runs')
        .insert({
          automation_id: automation.id,
          status: 'skipped',
          skip_reason: 'filter_not_matched',
          trigger_payload: input.payload as Json,
          finished_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (data) outcomes.push({ runId: data.id, status: 'skipped' });
      continue;
    }

    const outcome = await runAutomation(admin, automation, {
      triggerPayload: input.payload,
      chain: input.chain ?? [],
    });
    outcomes.push(outcome);
  }

  return outcomes;
}

export function isDispatchable(kind: TriggerKind): kind is DispatchableTriggerKind {
  return (DISPATCHABLE_TRIGGERS as readonly TriggerKind[]).includes(kind);
}
