'use server';

/**
 * Mutations for playbooks and the checklist.
 *
 * Kept separate from `actions.ts` — which already carries the whole existing
 * campaigns module — so the planner's own surface (applying a playbook,
 * managing checklist rows) is easy to find and review on its own. Same two
 * rules as everywhere else: `requireUser()` first, and nothing reaches the
 * database without a schema in `@/lib/planner/validation` first.
 */

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { failed, ok, type ActionState } from '@/lib/campaigns/action-state';
import { friendlyDbError } from '@/lib/campaigns/db-errors';
import { buildCampaignTaskInserts } from '@/lib/planner/apply';
import {
  copiedPlaybookTaskIds,
  getCampaignRow,
  getCampaignTask,
  listPlaybookTasks,
  nextTaskSortOrder,
} from '@/lib/planner/queries';
import type { CampaignTaskInsert } from '@/lib/planner/types';
import {
  addCampaignTaskSchema,
  applyPlaybookSchema,
  firstIssue,
  rescheduleCampaignTaskSchema,
  toggleCampaignTaskSchema,
  updateCampaignTaskSchema,
  uuidSchema,
} from '@/lib/planner/validation';

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function refresh(campaignId: string): void {
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath('/calendar');
}

// --- applying a playbook -----------------------------------------------

/**
 * Copies a playbook's tasks into a campaign's checklist.
 *
 * Safe to click more than once: any playbook task already copied in (by
 * `playbook_task_id`) is skipped, so re-applying after adding a task by hand
 * cannot duplicate the rest. The campaign's own `posting_days` and
 * `posting_time` are used — not the playbook's — so a playbook applied to an
 * existing campaign respects the schedule already chosen for it.
 */
export async function applyPlaybook(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = applyPlaybookSchema.safeParse({
    campaignId: text(formData, 'campaignId'),
    playbookId: text(formData, 'playbookId'),
  });
  if (!parsed.success) return failed(firstIssue(parsed.error));
  const { campaignId, playbookId } = parsed.data;

  const campaign = await getCampaignRow(supabase, campaignId);
  if (!campaign) return failed('That campaign no longer exists.');
  if (!campaign.starts_on) {
    return failed(
      'Set a start date on this campaign first — the plan’s tasks are dated from it.',
    );
  }

  const playbookTasks = await listPlaybookTasks(supabase, playbookId);
  if (playbookTasks.length === 0) {
    return failed('That plan has no tasks to add.');
  }

  const alreadyCopied = await copiedPlaybookTaskIds(supabase, campaignId);
  const rows = buildCampaignTaskInserts({
    campaignId,
    startsOn: campaign.starts_on,
    postingDays: campaign.posting_days,
    postingTime: campaign.posting_time,
    playbookTasks,
    alreadyCopied,
  });

  if (rows.length === 0) {
    return ok('Every task from this plan is already on the checklist.');
  }

  const { error: tasksError } = await supabase
    .from('campaign_tasks')
    .insert(rows);
  if (tasksError) {
    return failed(friendlyDbError(tasksError.message, 'Could not add the plan’s tasks.'));
  }

  if (campaign.playbook_id !== playbookId) {
    await supabase.from('campaigns').update({ playbook_id: playbookId }).eq('id', campaignId);
  }

  refresh(campaignId);
  return ok(
    `${rows.length} task${rows.length === 1 ? '' : 's'} added to the checklist.`,
  );
}

// --- checklist CRUD ------------------------------------------------------

export async function addCampaignTask(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = addCampaignTaskSchema.safeParse({
    campaignId: text(formData, 'campaignId'),
    title: text(formData, 'title'),
    detail: text(formData, 'detail'),
    kind: text(formData, 'kind'),
    dueOn: text(formData, 'dueOn'),
    dueTime: text(formData, 'dueTime'),
    clientId: text(formData, 'clientId'),
    postId: text(formData, 'postId'),
    assignedTo: text(formData, 'assignedTo'),
  });
  if (!parsed.success) return failed(firstIssue(parsed.error));
  const input = parsed.data;

  const campaign = await getCampaignRow(supabase, input.campaignId);
  if (!campaign) return failed('That campaign no longer exists.');

  const sortOrder = await nextTaskSortOrder(supabase, input.campaignId);

  const insert: CampaignTaskInsert = {
    campaign_id: input.campaignId,
    playbook_task_id: null,
    title: input.title,
    detail: input.detail,
    kind: input.kind,
    due_on: input.dueOn,
    due_time: input.dueTime,
    client_id: input.clientId,
    post_id: input.postId,
    assigned_to: input.assignedTo,
    sort_order: sortOrder,
  };

  const { error } = await supabase.from('campaign_tasks').insert(insert);
  if (error) return failed(friendlyDbError(error.message, 'Could not add the task.'));

  refresh(input.campaignId);
  return ok('Task added.');
}

export async function updateCampaignTask(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = updateCampaignTaskSchema.safeParse({
    taskId: text(formData, 'taskId'),
    title: text(formData, 'title'),
    detail: text(formData, 'detail'),
    kind: text(formData, 'kind'),
    dueOn: text(formData, 'dueOn'),
    dueTime: text(formData, 'dueTime'),
    clientId: text(formData, 'clientId'),
    postId: text(formData, 'postId'),
    assignedTo: text(formData, 'assignedTo'),
  });
  if (!parsed.success) return failed(firstIssue(parsed.error));
  const input = parsed.data;

  const task = await getCampaignTask(supabase, input.taskId);
  if (!task) return failed('That task no longer exists.');

  const { error } = await supabase
    .from('campaign_tasks')
    .update({
      title: input.title,
      detail: input.detail,
      kind: input.kind,
      due_on: input.dueOn,
      due_time: input.dueTime,
      client_id: input.clientId,
      post_id: input.postId,
      assigned_to: input.assignedTo,
    })
    .eq('id', task.id);
  if (error) return failed(friendlyDbError(error.message, 'Could not save the task.'));

  refresh(task.campaign_id);
  return ok('Task saved.');
}

export async function toggleCampaignTask(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = toggleCampaignTaskSchema.safeParse({
    taskId: text(formData, 'taskId'),
    done: text(formData, 'done'),
  });
  if (!parsed.success) return failed(firstIssue(parsed.error));
  const { taskId, done } = parsed.data;

  const task = await getCampaignTask(supabase, taskId);
  if (!task) return failed('That task no longer exists.');

  const { error } = await supabase
    .from('campaign_tasks')
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq('id', taskId);
  if (error) return failed(friendlyDbError(error.message, 'Could not update the task.'));

  refresh(task.campaign_id);
  return ok(done ? 'Marked done.' : 'Marked not done.');
}

export async function deleteCampaignTask(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = uuidSchema.safeParse(text(formData, 'taskId'));
  if (!parsed.success) return failed('That task could not be identified.');

  const task = await getCampaignTask(supabase, parsed.data);
  if (!task) return failed('That task no longer exists.');

  const { error } = await supabase
    .from('campaign_tasks')
    .delete()
    .eq('id', task.id);
  if (error) return failed('Could not delete the task.');

  refresh(task.campaign_id);
  return ok('Task deleted.');
}

/** Drag-to-reschedule on the calendar: moves one task to a new due date. */
export async function rescheduleCampaignTask(
  taskId: string,
  dueOn: string,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = rescheduleCampaignTaskSchema.safeParse({ taskId, dueOn });
  if (!parsed.success) return failed(firstIssue(parsed.error));

  const task = await getCampaignTask(supabase, parsed.data.taskId);
  if (!task) return failed('That task no longer exists.');

  const { error } = await supabase
    .from('campaign_tasks')
    .update({ due_on: parsed.data.dueOn })
    .eq('id', task.id);
  if (error) return failed(friendlyDbError(error.message, 'Could not reschedule the task.'));

  revalidatePath(`/campaigns/${task.campaign_id}`);
  revalidatePath('/calendar');
  return ok('Task rescheduled.');
}
