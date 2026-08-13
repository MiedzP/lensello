/**
 * The engine. One call in, one `automation_runs` row and one
 * `automation_run_steps` row per step out — always, even when nothing ran.
 *
 * Call order matters and mirrors the brief exactly:
 *
 *   1. enabled?              -> skip, `disabled`
 *   2. loop / chain depth?   -> skip, `loop_detected` / `chain_too_deep`
 *   3. rate limit?           -> skip, `rate_limited`     (before any step runs)
 *   4. run the steps in order, honouring `continue_on_error`
 *
 * Every one of those first three produces a real `automation_runs` row with a
 * `skip_reason` — never a silent early return — because "why did this never
 * fire" needs the same kind of answer as "why did this client get three
 * messages", and both live in this one table.
 */

import type { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/db.types';
import { buildRunContext } from './context';
import { hasCycle, isTooDeep } from './loop-guard';
import { checkRateLimit } from './rate-limit';
import { STEP_EXECUTORS, StepSkipped } from './steps';
import type { Automation, AutomationStep, RunStatus, SkipReason, TriggerKind } from './types';

type Admin = ReturnType<typeof createAdminClient>;

export interface RunOutcome {
  runId: string;
  status: RunStatus;
}

export interface RunOptions {
  /** Whatever the trigger site knows. Shape is a contract, not a type — see `dispatch.ts`. */
  triggerPayload?: Record<string, unknown>;
  /** Automation ids already in this event's causation chain. Empty for a fresh, externally-caused run. */
  chain?: string[];
}

async function recordSkippedRun(
  admin: Admin,
  automation: Pick<Automation, 'id'>,
  triggerPayload: Json | null,
  reason: SkipReason,
): Promise<RunOutcome> {
  const { data, error } = await admin
    .from('automation_runs')
    .insert({
      automation_id: automation.id,
      status: 'skipped',
      skip_reason: reason,
      trigger_payload: triggerPayload,
      finished_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    // Recording the skip failed; there is nothing further to do — the run
    // genuinely did not execute, so there is no partial state to unwind.
    console.error('[automations] could not record a skipped run', automation.id, reason, error);
    return { runId: '', status: 'skipped' };
  }

  return { runId: data.id, status: 'skipped' };
}

/**
 * After `update_client_stage` succeeds, this may itself be the event
 * `client_stage_changed` fires on. Dynamically imported to avoid a static
 * import cycle with `dispatch.ts`, which imports `runAutomation` from this
 * file — by the time this executes, both modules are already loaded, so the
 * cycle is only a build-graph shape, not a runtime problem.
 */
async function chainClientStageChanged(
  admin: Admin,
  clientId: string,
  fromStage: string,
  toStage: string,
  chain: string[],
): Promise<void> {
  try {
    const { dispatchAutomationEvent } = await import('./dispatch');
    await dispatchAutomationEvent(admin, {
      triggerKind: 'client_stage_changed',
      payload: { clientId, fromStage, toStage },
      chain,
    });
  } catch (cause) {
    // A chained automation's own failure must not be mistaken for this run's
    // failure — it already has its own run row recording whatever happened.
    console.error('[automations] chained client_stage_changed dispatch failed', cause);
  }
}

export async function runAutomation(
  admin: Admin,
  automation: Automation,
  options: RunOptions = {},
): Promise<RunOutcome> {
  const chain = options.chain ?? [];
  const triggerPayload = (options.triggerPayload ?? {}) as Json;

  if (!automation.enabled) {
    return recordSkippedRun(admin, automation, triggerPayload, 'disabled');
  }
  if (hasCycle(chain, automation.id)) {
    console.error(
      `[automations] loop detected — automation ${automation.id} (${automation.name}) reappears in its own chain: ${[...chain, automation.id].join(' -> ')}`,
    );
    return recordSkippedRun(admin, automation, triggerPayload, 'loop_detected');
  }
  if (isTooDeep(chain)) {
    return recordSkippedRun(admin, automation, triggerPayload, 'chain_too_deep');
  }

  const rate = await checkRateLimit(admin, automation);
  if (!rate.allowed) {
    return recordSkippedRun(admin, automation, triggerPayload, 'rate_limited');
  }

  const { data: runRow, error: runError } = await admin
    .from('automation_runs')
    .insert({ automation_id: automation.id, status: 'running', trigger_payload: triggerPayload })
    .select('id')
    .single();

  if (runError || !runRow) {
    throw new Error(`Could not start a run for "${automation.name}": ${runError?.message ?? 'unknown error'}`);
  }

  const { data: stepRows, error: stepsError } = await admin
    .from('automation_steps')
    .select('*')
    .eq('automation_id', automation.id)
    .order('sort_order', { ascending: true });

  if (stepsError) {
    await admin
      .from('automation_runs')
      .update({ status: 'failed', error: stepsError.message, finished_at: new Date().toISOString() })
      .eq('id', runRow.id);
    return { runId: runRow.id, status: 'failed' };
  }

  const steps: AutomationStep[] = stepRows ?? [];
  const context = await buildRunContext(
    admin,
    automation,
    automation.trigger_kind as TriggerKind,
    (triggerPayload ?? {}) as Record<string, unknown>,
  );

  const nextChain = [...chain, automation.id];
  let aborted = false;
  let fatalFailure = false;
  let skipRemaining = 0;

  for (const step of steps) {
    if (aborted) {
      await admin.from('automation_run_steps').insert({
        run_id: runRow.id,
        step_id: step.id,
        sort_order: step.sort_order,
        action_kind: step.action_kind,
        status: 'skipped',
        output: { reason: 'An earlier step failed and stopped the run.' },
        finished_at: new Date().toISOString(),
      });
      continue;
    }

    if (skipRemaining > 0) {
      skipRemaining -= 1;
      await admin.from('automation_run_steps').insert({
        run_id: runRow.id,
        step_id: step.id,
        sort_order: step.sort_order,
        action_kind: step.action_kind,
        status: 'skipped',
        output: { reason: 'A branch condition earlier in this run was not met.' },
        finished_at: new Date().toISOString(),
      });
      continue;
    }

    const { data: stepRow, error: stepInsertError } = await admin
      .from('automation_run_steps')
      .insert({
        run_id: runRow.id,
        step_id: step.id,
        sort_order: step.sort_order,
        action_kind: step.action_kind,
        status: 'running',
      })
      .select('id')
      .single();

    if (stepInsertError || !stepRow) {
      console.error('[automations] could not record a run step', stepInsertError);
      continue;
    }

    try {
      const executor = STEP_EXECUTORS[step.action_kind];
      const result = await executor({ admin, automation, step, context, chain: nextChain });

      await admin
        .from('automation_run_steps')
        .update({ status: 'succeeded', output: result.output, finished_at: new Date().toISOString() })
        .eq('id', stepRow.id);

      if (step.action_kind === 'branch' && result.skipNext) {
        skipRemaining = result.skipNext;
      }

      if (step.action_kind === 'update_client_stage' && context.client) {
        const output = result.output as { fromStage?: string; toStage?: string } | null;
        if (output?.toStage) {
          await chainClientStageChanged(
            admin,
            context.client.id,
            output.fromStage ?? '',
            output.toStage,
            nextChain,
          );
        }
      }
    } catch (cause) {
      if (cause instanceof StepSkipped) {
        await admin
          .from('automation_run_steps')
          .update({ status: 'skipped', output: { reason: cause.message }, finished_at: new Date().toISOString() })
          .eq('id', stepRow.id);
        continue;
      }

      const message = cause instanceof Error ? cause.message : 'The step failed.';
      await admin
        .from('automation_run_steps')
        .update({ status: 'failed', error: message, finished_at: new Date().toISOString() })
        .eq('id', stepRow.id);

      if (!step.continue_on_error) {
        aborted = true;
        fatalFailure = true;
      }
    }
  }

  const finalStatus: RunStatus = fatalFailure ? 'failed' : 'succeeded';
  const finishedAt = new Date().toISOString();

  await admin
    .from('automation_runs')
    .update({ status: finalStatus, finished_at: finishedAt })
    .eq('id', runRow.id);

  await admin
    .from('automations')
    .update({ last_run_at: finishedAt, run_count: automation.run_count + 1 })
    .eq('id', automation.id);

  return { runId: runRow.id, status: finalStatus };
}
