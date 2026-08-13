/**
 * Read helpers for playbooks and the checklist.
 *
 * Every function takes the caller's Supabase client so the query runs under
 * their RLS context — the same convention every other module in this app
 * follows.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db.types';
import type {
  CampaignPlaybookRow,
  CampaignRow,
  CampaignTaskRow,
  PlaybookTaskRow,
} from './types';

export type Db = SupabaseClient<Database>;

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

// --- playbooks -------------------------------------------------------------

export async function listPlaybooks(db: Db): Promise<CampaignPlaybookRow[]> {
  const { data, error } = await db
    .from('campaign_playbooks')
    .select('*')
    .eq('is_active', true)
    .order('season', { ascending: true })
    .order('name', { ascending: true });

  fail('Could not load playbooks', error);
  return data ?? [];
}

export async function getPlaybook(
  db: Db,
  playbookId: string,
): Promise<CampaignPlaybookRow | null> {
  const { data, error } = await db
    .from('campaign_playbooks')
    .select('*')
    .eq('id', playbookId)
    .maybeSingle();

  fail('Could not load the playbook', error);
  return data;
}

export async function listPlaybookTasks(
  db: Db,
  playbookId: string,
): Promise<PlaybookTaskRow[]> {
  const { data, error } = await db
    .from('playbook_tasks')
    .select('*')
    .eq('playbook_id', playbookId)
    .order('day_offset', { ascending: true })
    .order('sort_order', { ascending: true });

  fail('Could not load the playbook’s tasks', error);
  return data ?? [];
}

/** Every playbook's tasks in one round trip, keyed by playbook id. */
export async function mapPlaybookTasks(
  db: Db,
  playbookIds: readonly string[],
): Promise<Map<string, PlaybookTaskRow[]>> {
  const ids = [...new Set(playbookIds)];
  const map = new Map<string, PlaybookTaskRow[]>();
  if (ids.length === 0) return map;

  const { data, error } = await db
    .from('playbook_tasks')
    .select('*')
    .in('playbook_id', ids)
    .order('day_offset', { ascending: true })
    .order('sort_order', { ascending: true });

  fail('Could not load playbook tasks', error);
  for (const task of data ?? []) {
    const list = map.get(task.playbook_id) ?? [];
    list.push(task);
    map.set(task.playbook_id, list);
  }
  return map;
}

// --- the campaign's own plan -------------------------------------------------

export async function getCampaignRow(db: Db, campaignId: string): Promise<CampaignRow | null> {
  const { data, error } = await db
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();

  fail('Could not load the campaign', error);
  return data;
}

export async function listCampaignTasks(
  db: Db,
  campaignId: string,
): Promise<CampaignTaskRow[]> {
  const { data, error } = await db
    .from('campaign_tasks')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('due_on', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true });

  fail('Could not load the checklist', error);
  return data ?? [];
}

export async function getCampaignTask(
  db: Db,
  taskId: string,
): Promise<CampaignTaskRow | null> {
  const { data, error } = await db
    .from('campaign_tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();

  fail('Could not load the task', error);
  return data;
}

/** Playbook task ids already copied into this campaign, so re-applying is idempotent. */
export async function copiedPlaybookTaskIds(
  db: Db,
  campaignId: string,
): Promise<Set<string>> {
  const { data, error } = await db
    .from('campaign_tasks')
    .select('playbook_task_id')
    .eq('campaign_id', campaignId)
    .not('playbook_task_id', 'is', null);

  fail('Could not check the existing checklist', error);
  return new Set(
    (data ?? [])
      .map((row) => row.playbook_task_id)
      .filter((id): id is string => Boolean(id)),
  );
}

/** Every task due in `[fromDate, toDate]` (inclusive), for the calendar. */
export async function listCampaignTasksDueBetween(
  db: Db,
  fromDate: string,
  toDate: string,
): Promise<CampaignTaskRow[]> {
  const { data, error } = await db
    .from('campaign_tasks')
    .select('*')
    .gte('due_on', fromDate)
    .lte('due_on', toDate)
    .order('due_on', { ascending: true })
    .order('sort_order', { ascending: true });

  fail('Could not load the calendar’s checklist items', error);
  return data ?? [];
}

export async function nextTaskSortOrder(db: Db, campaignId: string): Promise<number> {
  const { data, error } = await db
    .from('campaign_tasks')
    .select('sort_order')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  fail('Could not work out the checklist order', error);
  return data ? data.sort_order + 1 : 0;
}

// --- campaigns, for the calendar and the playbook picker --------------------

export interface CampaignRef {
  id: string;
  name: string;
  status: string;
}

export async function listCampaignRefs(db: Db): Promise<CampaignRef[]> {
  const { data, error } = await db
    .from('campaigns')
    .select('id, name, status')
    .order('name', { ascending: true });

  fail('Could not load campaigns', error);
  return data ?? [];
}

/** Campaigns "running now": active/scheduled and today falls inside their window. */
export async function listRunningCampaigns(db: Db, todayIso: string): Promise<CampaignRow[]> {
  const { data, error } = await db
    .from('campaigns')
    .select('*')
    .in('status', ['active', 'scheduled'])
    .or(`starts_on.is.null,starts_on.lte.${todayIso}`)
    .or(`ends_on.is.null,ends_on.gte.${todayIso}`);

  fail('Could not load running campaigns', error);
  return data ?? [];
}

// --- clients + staff (read-only; owned by other modules) --------------------

export interface ClientRef {
  id: string;
  name: string;
}

export async function listClientRefs(db: Db): Promise<ClientRef[]> {
  const { data, error } = await db
    .from('clients')
    .select('id, name')
    .order('name', { ascending: true });

  fail('Could not load clients', error);
  return data ?? [];
}

export async function mapClientsById(
  db: Db,
  clientIds: readonly (string | null)[],
): Promise<Map<string, ClientRef>> {
  const ids = [...new Set(clientIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const { data, error } = await db.from('clients').select('id, name').in('id', ids);
  fail('Could not load clients', error);
  return new Map((data ?? []).map((client) => [client.id, client]));
}

export interface StaffRef {
  id: string;
  full_name: string;
}

export async function listStaffRefs(db: Db): Promise<StaffRef[]> {
  const { data, error } = await db
    .from('profiles')
    .select('id, full_name')
    .order('full_name', { ascending: true });

  fail('Could not load staff', error);
  return data ?? [];
}

export async function mapStaffById(
  db: Db,
  staffIds: readonly (string | null)[],
): Promise<Map<string, StaffRef>> {
  const ids = [...new Set(staffIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const { data, error } = await db.from('profiles').select('id, full_name').in('id', ids);
  fail('Could not load staff', error);
  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}
