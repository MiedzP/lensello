'use server';

/**
 * Every mutation for the automations module.
 *
 * `requireUser()` first, always — these are reachable by direct POST, and the
 * fact that the UI only shows "Run now" on an enabled automation proves
 * nothing about what a caller will try to POST.
 *
 * Two things this file is careful about that most modules are not:
 *
 *  - `runNowAction` executes real steps — real emails, real DMs. It requires
 *    the automation to already be enabled (the same rule that gates every
 *    other trigger) and a typed confirmation of the automation's name, the
 *    same pattern `eraseClientAction` in the clients module uses for its own
 *    irreversible action.
 *  - API keys are minted here and returned to the caller exactly once, inside
 *    the action's return value — never re-read from anywhere afterwards.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import type { Json } from '@/lib/db.types';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateApiKey } from '@/lib/automations/api-keys';
import { readActionConfigForm, readTriggerConfigForm } from '@/lib/automations/form-parse';
import { runAutomation } from '@/lib/automations/runner';
import {
  ACTION_CONFIG_SCHEMAS,
  TRIGGER_CONFIG_SCHEMAS,
  actionKindSchema,
  addStepSchema,
  createApiKeySchema,
  createAutomationSchema,
  deleteAutomationSchema,
  firstIssue,
  manualRunSchema,
  moveStepSchema,
  removeStepSchema,
  revokeApiKeySchema,
  setEnabledSchema,
  triggerKindSchema,
  updateAutomationSchema,
} from '@/lib/automations/schemas';
import { failed, ok, IDLE_KEY_STATE, type ActionState, type CreateKeyState } from '@/lib/automations/action-state';

function invalidate(automationId?: string): void {
  revalidatePath('/automations');
  if (automationId) revalidatePath(`/automations/${automationId}`);
}

// --- automations -----------------------------------------------------------

export async function createAutomationAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const parsed = createAutomationSchema.safeParse({
    name: formData.get('name') ?? '',
    description: formData.get('description') ?? '',
    triggerKind: formData.get('triggerKind') ?? '',
  });

  if (!parsed.success) {
    throw new Error(firstIssue(parsed.error));
  }

  const { data, error } = await supabase
    .from('automations')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      trigger_kind: parsed.data.triggerKind,
      // The check constraint's default matches, but writing it explicitly
      // here means it survives even if that default is ever removed.
      enabled: false,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Could not create the automation: ${error?.message ?? 'unknown error'}`);
  }

  invalidate();
  redirect(`/automations/${data.id}`);
}

export async function updateAutomationAction(
  previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = updateAutomationSchema.safeParse({
    automationId: formData.get('automationId') ?? '',
    name: formData.get('name') ?? '',
    description: formData.get('description') ?? '',
    maxRunsPerDay: formData.get('maxRunsPerDay') ?? '',
  });

  if (!parsed.success) return failed(firstIssue(parsed.error));

  const { automationId, name, description, maxRunsPerDay } = parsed.data;

  const { error } = await supabase
    .from('automations')
    .update({ name, description: description || null, max_runs_per_day: maxRunsPerDay ?? null })
    .eq('id', automationId);

  if (error) return failed(`Could not save: ${error.message}`);

  invalidate(automationId);
  return ok('Saved.');
}

export async function updateTriggerConfigAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const automationId = String(formData.get('automationId') ?? '');
  const triggerKindParsed = triggerKindSchema.safeParse(formData.get('triggerKind'));
  if (!automationId || !triggerKindParsed.success) throw new Error('Missing or invalid trigger.');

  const raw = readTriggerConfigForm(triggerKindParsed.data, formData);
  const configParsed = TRIGGER_CONFIG_SCHEMAS[triggerKindParsed.data].safeParse(raw);
  if (!configParsed.success) throw new Error(firstIssue(configParsed.error));

  const { error } = await supabase
    .from('automations')
    .update({ trigger_config: configParsed.data as Json })
    .eq('id', automationId);

  if (error) throw new Error(`Could not save the trigger: ${error.message}`);

  invalidate(automationId);
}

export async function setEnabledAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const parsed = setEnabledSchema.safeParse({
    automationId: formData.get('automationId') ?? '',
    enabled: formData.get('enabled') ?? 'false',
  });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));

  const { error } = await supabase
    .from('automations')
    .update({ enabled: parsed.data.enabled })
    .eq('id', parsed.data.automationId);

  if (error) throw new Error(`Could not change that: ${error.message}`);

  invalidate(parsed.data.automationId);
}

export async function deleteAutomationAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const parsed = deleteAutomationSchema.safeParse({ automationId: formData.get('automationId') ?? '' });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));

  const { error } = await supabase.from('automations').delete().eq('id', parsed.data.automationId);
  if (error) throw new Error(`Could not delete: ${error.message}`);

  invalidate();
  redirect('/automations');
}

// --- steps -------------------------------------------------------------

export async function addStepAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const parsed = addStepSchema.safeParse({
    automationId: formData.get('automationId') ?? '',
    actionKind: formData.get('actionKind') ?? '',
    continueOnError: formData.get('continueOnError') ?? 'false',
  });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));

  const { count } = await supabase
    .from('automation_steps')
    .select('id', { count: 'exact', head: true })
    .eq('automation_id', parsed.data.automationId);

  const { error } = await supabase.from('automation_steps').insert({
    automation_id: parsed.data.automationId,
    action_kind: parsed.data.actionKind,
    sort_order: count ?? 0,
    continue_on_error: parsed.data.continueOnError,
    // Saved empty; the schema's own defaults fill in on first parse, so an
    // untouched step is still legible in a preview rather than blank.
    config: {},
  });

  if (error) throw new Error(`Could not add the step: ${error.message}`);

  invalidate(parsed.data.automationId);
}

export async function updateStepConfigAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const automationId = String(formData.get('automationId') ?? '');
  const stepId = String(formData.get('stepId') ?? '');
  const actionKindParsed = actionKindSchema.safeParse(formData.get('actionKind'));
  if (!automationId || !stepId || !actionKindParsed.success) {
    throw new Error('Missing or invalid step.');
  }

  const raw = readActionConfigForm(actionKindParsed.data, formData);
  const configParsed = ACTION_CONFIG_SCHEMAS[actionKindParsed.data].safeParse(raw);
  if (!configParsed.success) throw new Error(firstIssue(configParsed.error));

  const continueOnError = formData.get('continueOnError') === 'on' || formData.get('continueOnError') === 'true';

  const { error } = await supabase
    .from('automation_steps')
    .update({ config: configParsed.data as Json, continue_on_error: continueOnError })
    .eq('id', stepId)
    .eq('automation_id', automationId);

  if (error) throw new Error(`Could not save the step: ${error.message}`);

  invalidate(automationId);
}

export async function removeStepAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const parsed = removeStepSchema.safeParse({
    automationId: formData.get('automationId') ?? '',
    stepId: formData.get('stepId') ?? '',
  });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));

  const { error } = await supabase
    .from('automation_steps')
    .delete()
    .eq('id', parsed.data.stepId)
    .eq('automation_id', parsed.data.automationId);

  if (error) throw new Error(`Could not remove the step: ${error.message}`);

  invalidate(parsed.data.automationId);
}

/**
 * Swaps `sort_order` with the neighbour in the requested direction. No
 * drag-and-drop: two buttons and a swap keep this a Server Action rather than
 * a client-side reordering library, and a photographer moving a step one
 * place is a more common need than moving it several.
 */
export async function moveStepAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const parsed = moveStepSchema.safeParse({
    automationId: formData.get('automationId') ?? '',
    stepId: formData.get('stepId') ?? '',
    direction: formData.get('direction') ?? '',
  });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));

  const { data: steps, error } = await supabase
    .from('automation_steps')
    .select('id, sort_order')
    .eq('automation_id', parsed.data.automationId)
    .order('sort_order', { ascending: true });

  if (error || !steps) throw new Error(`Could not load steps: ${error?.message ?? 'unknown error'}`);

  const index = steps.findIndex((step) => step.id === parsed.data.stepId);
  const targetIndex = parsed.data.direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= steps.length) return;

  const current = steps[index]!;
  const target = steps[targetIndex]!;

  await Promise.all([
    supabase.from('automation_steps').update({ sort_order: target.sort_order }).eq('id', current.id),
    supabase.from('automation_steps').update({ sort_order: current.sort_order }).eq('id', target.id),
  ]);

  invalidate(parsed.data.automationId);
}

// --- running -------------------------------------------------------------

/**
 * Runs the automation for real, right now. Requires the automation to be
 * enabled and the operator to type its name — the same friction
 * `eraseClientAction` uses, because this can send a real message just as
 * irreversibly as that action deletes a record.
 */
export async function runNowAction(previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = manualRunSchema.safeParse({
    automationId: formData.get('automationId') ?? '',
    clientId: formData.get('clientId') ?? '',
    confirm: formData.get('confirm') ?? '',
  });
  if (!parsed.success) return failed(firstIssue(parsed.error));

  const { data: automation } = await supabase
    .from('automations')
    .select('*')
    .eq('id', parsed.data.automationId)
    .maybeSingle();

  if (!automation) return failed('That automation no longer exists.');
  if (!automation.enabled) return failed('Turn the automation on before running it — a disabled automation stays off on purpose.');
  if (parsed.data.confirm.trim() !== automation.name) {
    return failed(`Type the automation's name exactly (${automation.name}) to confirm.`);
  }

  // The service-role client, not the session one: runs are only ever written
  // this way (see the runner and the migration's RLS comment), even when the
  // trigger was a person clicking a button rather than an API key.
  const admin = createAdminClient();

  const payload: Record<string, unknown> = {};
  if (parsed.data.clientId) payload.clientId = parsed.data.clientId;

  const outcome = await runAutomation(admin, automation, { triggerPayload: payload, chain: [] });

  invalidate(automation.id);
  return ok(`Run ${outcome.status}. Check the run history below for details.`);
}

// --- API keys --------------------------------------------------------------

export async function createApiKeyAction(
  _previous: CreateKeyState,
  formData: FormData,
): Promise<CreateKeyState> {
  const { supabase, user } = await requireUser();

  const parsed = createApiKeySchema.safeParse({
    name: formData.get('name') ?? '',
    scopes: formData.getAll('scopes'),
  });
  if (!parsed.success) return { ...IDLE_KEY_STATE, error: firstIssue(parsed.error) };

  const minted = generateApiKey();

  const { error } = await supabase.from('api_keys').insert({
    name: parsed.data.name,
    key_prefix: minted.prefix,
    key_hash: minted.hash,
    scopes: parsed.data.scopes,
    created_by: user.id,
  });

  if (error) return { ...IDLE_KEY_STATE, error: `Could not create the key: ${error.message}` };

  revalidatePath('/automations/keys');

  return {
    error: null,
    message: 'Copy this key now — it will not be shown again.',
    mintedKey: minted.key,
  };
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();

  const parsed = revokeApiKeySchema.safeParse({ keyId: formData.get('keyId') ?? '' });
  if (!parsed.success) throw new Error(firstIssue(parsed.error));

  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', parsed.data.keyId);

  if (error) throw new Error(`Could not revoke the key: ${error.message}`);

  revalidatePath('/automations/keys');
}
