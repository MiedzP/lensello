/**
 * `create_task` — adds a checklist item to a gig or a campaign.
 *
 * There is no generic "tasks" table: `gig_tasks` belongs to a gig,
 * `campaign_tasks` belongs to a campaign. This step writes to whichever the
 * automation is configured for, using the gig from the run's context for the
 * `gig` target (present when the trigger was `gig_booked` or `gig_upcoming`,
 * or when the payload carried a `gigId`) and an explicit `campaignId` for the
 * `campaign` target, since nothing about a run otherwise names a campaign.
 */

import type { Json } from '@/lib/db.types';
import { createTaskConfigSchema } from '../schemas';
import { renderTemplate } from '../template';
import { templateVars } from '../context';
import { parseStepConfig, type StepExecutor } from './exec-types';

function addDays(days: number | undefined): string | null {
  if (days === undefined) return null;
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const createTask: StepExecutor = async ({ admin, step, context }) => {
  const config = parseStepConfig(createTaskConfigSchema, step.config);
  const label = renderTemplate(config.label, templateVars(context));

  if (config.target === 'gig') {
    if (!context.gig) {
      throw new Error(
        'This trigger has no gig attached, so there is nowhere to add a gig task. ' +
          'Use the "campaign" target instead, or pick a gig-related trigger.',
      );
    }

    const { count } = await admin
      .from('gig_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('gig_id', context.gig.id);

    const { error } = await admin.from('gig_tasks').insert({
      gig_id: context.gig.id,
      label,
      position: count ?? 0,
      due_at: config.dueInDays !== undefined ? addDays(config.dueInDays) : null,
    });

    if (error) throw new Error(`Could not add the gig task: ${error.message}`);
    const output: Json = { target: 'gig', gigId: context.gig.id, label };
    return { output };
  }

  if (!config.campaignId) {
    throw new Error('This step targets a campaign task but no campaign was chosen when it was configured.');
  }

  const { count } = await admin
    .from('campaign_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', config.campaignId);

  const { error } = await admin.from('campaign_tasks').insert({
    campaign_id: config.campaignId,
    title: label,
    // 'admin' is the closest fit in the campaign_tasks kind enum for a task an
    // automation created rather than one that came from a playbook template.
    kind: 'admin',
    due_on: addDays(config.dueInDays ?? 0),
    client_id: context.client?.id ?? null,
    sort_order: count ?? 0,
  });

  if (error) throw new Error(`Could not add the campaign task: ${error.message}`);
  const output: Json = { target: 'campaign', campaignId: config.campaignId, label };
  return { output };
};
