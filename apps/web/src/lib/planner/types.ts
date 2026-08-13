/**
 * Row types for the planner tables (`campaign_playbooks`, `playbook_tasks`,
 * `campaign_tasks`) and the columns `20260813120200_campaign_planner.sql`
 * adds to `campaigns`.
 *
 * All of this is already declared in `@/lib/db.types` — this module just
 * re-exports the pieces under names that read better at the call site
 * (`CampaignTaskRow` rather than `Tables<'campaign_tasks'>`), the same way
 * `@/lib/campaigns/queries` aliases `Tables<'campaigns'>`.
 */

import type { Tables, TablesInsert, TablesUpdate } from '@/lib/db.types';

// --- shared vocabulary ----------------------------------------------------

export const PLAYBOOK_SEASONS = [
  'wedding_fair',
  'engagement',
  'new_year',
  'valentines',
  'spring',
  'summer',
  'autumn',
  'christmas',
  'evergreen',
  'other',
] as const;
export type PlaybookSeason = (typeof PLAYBOOK_SEASONS)[number];

export const TASK_KINDS = [
  'post',
  'story',
  'email',
  'outreach',
  'ad',
  'call',
  'shoot',
  'admin',
  'print',
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

/** Kinds that represent a scheduled piece of content, not a to-do. */
export const POST_LIKE_KINDS: readonly TaskKind[] = ['post', 'story'];

export function isPostLikeKind(kind: string): kind is 'post' | 'story' {
  return (POST_LIKE_KINDS as readonly string[]).includes(kind);
}

// --- table row aliases ------------------------------------------------------

export type CampaignPlaybookRow = Tables<'campaign_playbooks'>;
export type CampaignPlaybookInsert = TablesInsert<'campaign_playbooks'>;
export type CampaignPlaybookUpdate = TablesUpdate<'campaign_playbooks'>;

export type PlaybookTaskRow = Tables<'playbook_tasks'>;
export type PlaybookTaskInsert = TablesInsert<'playbook_tasks'>;

export type CampaignTaskRow = Tables<'campaign_tasks'>;
export type CampaignTaskInsert = TablesInsert<'campaign_tasks'>;
export type CampaignTaskUpdate = TablesUpdate<'campaign_tasks'>;

/** `campaigns`, widened with the planner columns it already carries. */
export type CampaignRow = Tables<'campaigns'>;
