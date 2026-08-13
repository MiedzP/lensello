/**
 * Turns a playbook's tasks into the dated `campaign_tasks` rows to insert.
 *
 * Pure and DB-free on purpose, so the interesting logic — where each task
 * lands, and which ones to skip on a second apply — is unit-testable without
 * a database. The actual `.insert()` happens in the Server Action, which also
 * owns deciding *which* tasks to skip (by loading `copiedPlaybookTaskIds`
 * first) so that clicking "Apply" twice copies each playbook task in once.
 */

import { layOutTaskDate, sanitizePostingDays } from './dates';
import { isPostLikeKind, type CampaignTaskInsert, type PlaybookTaskRow } from './types';

export interface BuildCampaignTasksInput {
  campaignId: string;
  /** The campaign's `starts_on`. Required — offsets have nothing to anchor to without it. */
  startsOn: string;
  postingDays: readonly number[];
  /** The campaign's `posting_time`, applied to generated post/story tasks. */
  postingTime: string;
  playbookTasks: readonly PlaybookTaskRow[];
  /** Playbook task ids already copied into this campaign — skipped, not duplicated. */
  alreadyCopied?: ReadonlySet<string>;
}

/**
 * Builds the insert rows for applying a playbook to a campaign.
 *
 * Each row keeps `playbook_task_id` as provenance (nulled automatically if
 * the template row is later deleted, per the migration's `on delete set
 * null`) but everything else is copied by value — editing the playbook after
 * this runs cannot reach back and change what already happened.
 */
export function buildCampaignTaskInserts(
  input: BuildCampaignTasksInput,
): CampaignTaskInsert[] {
  const postingDays = sanitizePostingDays(input.postingDays);
  const skip = input.alreadyCopied ?? new Set<string>();

  return input.playbookTasks
    .filter((task) => !skip.has(task.id))
    .map((task) => {
      const { dueOn } = layOutTaskDate(input.startsOn, task, postingDays);
      return {
        campaign_id: input.campaignId,
        playbook_task_id: task.id,
        title: task.title,
        detail: task.detail,
        kind: task.kind,
        due_on: dueOn,
        due_time: isPostLikeKind(task.kind) ? input.postingTime : null,
        client_id: null,
        post_id: null,
        assigned_to: null,
        sort_order: task.sort_order,
      } satisfies CampaignTaskInsert;
    });
}
