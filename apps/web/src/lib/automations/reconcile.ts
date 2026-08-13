/**
 * The polling reconciler for triggers that have no single write event to hook.
 *
 * `gig_upcoming`, `campaign_task_due`, and `schedule` are all "is it time yet"
 * questions, not "something just happened" ones — there is no call site to
 * wire a dispatch into. Instead this runs once a day from
 * `api/cron/automations`, asks each question, and runs whatever is due.
 *
 * Idempotency is the load-bearing property here, checked with a `jsonb`
 * containment filter rather than a unique constraint: a cron invocation that
 * runs twice in one day (a retried Vercel invocation, a manual re-trigger)
 * must not fire the same gig-reminder or campaign-task-nudge twice. Each
 * check asks "does a run already exist today that names this exact
 * gig/task/automation" before creating another.
 */

import type { createAdminClient } from '@/lib/supabase/admin';
import type { Tables } from '@/lib/db.types';
import { runAutomation } from './runner';
import type { Automation } from './types';

type CampaignTaskKind = Tables<'campaign_tasks'>['kind'];

type Admin = ReturnType<typeof createAdminClient>;

export interface ReconcileSummary {
  gigUpcoming: number;
  campaignTaskDue: number;
  schedule: number;
  errors: string[];
}

function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function dateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function alreadyRanToday(
  admin: Admin,
  automationId: string,
  containment: Record<string, unknown>,
  todayStart: string,
): Promise<boolean> {
  const { count } = await admin
    .from('automation_runs')
    .select('id', { count: 'exact', head: true })
    .eq('automation_id', automationId)
    .gte('started_at', todayStart)
    .contains('trigger_payload', containment);

  return (count ?? 0) > 0;
}

async function reconcileGigUpcoming(admin: Admin, todayStart: string, summary: ReconcileSummary): Promise<void> {
  const { data: automations } = await admin
    .from('automations')
    .select('*')
    .eq('trigger_kind', 'gig_upcoming')
    .eq('enabled', true);

  for (const automation of automations ?? []) {
    const config = (automation.trigger_config ?? {}) as { daysBefore?: number };
    const daysBefore = typeof config.daysBefore === 'number' ? config.daysBefore : 3;

    const target = new Date();
    target.setUTCDate(target.getUTCDate() + daysBefore);
    const dayStart = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const { data: gigs, error } = await admin
      .from('gigs')
      .select('id, client_id')
      .eq('status', 'confirmed')
      .gte('starts_at', dayStart.toISOString())
      .lt('starts_at', dayEnd.toISOString());

    if (error) {
      summary.errors.push(`gig_upcoming (${automation.name}): ${error.message}`);
      continue;
    }

    for (const gig of gigs ?? []) {
      const ran = await alreadyRanToday(admin, automation.id, { gigId: gig.id }, todayStart);
      if (ran) continue;

      await runAutomation(admin, automation as Automation, {
        triggerPayload: { gigId: gig.id, clientId: gig.client_id },
        chain: [],
      });
      summary.gigUpcoming += 1;
    }
  }
}

async function reconcileCampaignTaskDue(admin: Admin, todayStart: string, summary: ReconcileSummary): Promise<void> {
  const { data: automations } = await admin
    .from('automations')
    .select('*')
    .eq('trigger_kind', 'campaign_task_due')
    .eq('enabled', true);

  const today = dateOnlyUtc(new Date());

  for (const automation of automations ?? []) {
    const config = (automation.trigger_config ?? {}) as { taskKind?: string };

    let query = admin
      .from('campaign_tasks')
      .select('id, client_id, kind')
      .lte('due_on', today)
      .is('done_at', null);

    if (config.taskKind) {
      query = query.eq('kind', config.taskKind as CampaignTaskKind);
    }

    const { data: tasks, error } = await query;

    if (error) {
      summary.errors.push(`campaign_task_due (${automation.name}): ${error.message}`);
      continue;
    }

    for (const task of tasks ?? []) {
      const ran = await alreadyRanToday(admin, automation.id, { campaignTaskId: task.id }, todayStart);
      if (ran) continue;

      await runAutomation(admin, automation as Automation, {
        triggerPayload: { campaignTaskId: task.id, clientId: task.client_id },
        chain: [],
      });
      summary.campaignTaskDue += 1;
    }
  }
}

async function reconcileSchedule(admin: Admin, todayStart: string, summary: ReconcileSummary): Promise<void> {
  const { data: automations } = await admin
    .from('automations')
    .select('*')
    .eq('trigger_kind', 'schedule')
    .eq('enabled', true);

  const todayDow = new Date().getUTCDay();

  for (const automation of automations ?? []) {
    const config = (automation.trigger_config ?? {}) as { daysOfWeek?: number[] };
    const days = config.daysOfWeek ?? [];
    if (days.length > 0 && !days.includes(todayDow)) continue;

    const { count } = await admin
      .from('automation_runs')
      .select('id', { count: 'exact', head: true })
      .eq('automation_id', automation.id)
      .gte('started_at', todayStart);

    if ((count ?? 0) > 0) continue;

    await runAutomation(admin, automation as Automation, { triggerPayload: {}, chain: [] });
    summary.schedule += 1;
  }
}

export async function reconcileScheduledAutomations(admin: Admin, now: Date = new Date()): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { gigUpcoming: 0, campaignTaskDue: 0, schedule: 0, errors: [] };
  const todayStart = startOfUtcDay(now);

  await reconcileGigUpcoming(admin, todayStart, summary);
  await reconcileCampaignTaskDue(admin, todayStart, summary);
  await reconcileSchedule(admin, todayStart, summary);

  return summary;
}
