/**
 * Reads for the builder UI. All through the caller's cookie-bound client —
 * `automations_staff_all` and the runs' staff SELECT policies are what
 * actually gate this, same as every other module.
 */

import type { Session } from '@/lib/auth';
import type { Automation, AutomationRun, AutomationRunStep, AutomationStep, ApiKeyRow } from './types';

type Supabase = Session['supabase'];

export async function listAutomations(supabase: Supabase): Promise<Automation[]> {
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load automations: ${error.message}`);
  return data ?? [];
}

export interface AutomationDetail {
  automation: Automation;
  steps: AutomationStep[];
}

export async function getAutomationDetail(supabase: Supabase, automationId: string): Promise<AutomationDetail | null> {
  const { data: automation } = await supabase
    .from('automations')
    .select('*')
    .eq('id', automationId)
    .maybeSingle();

  if (!automation) return null;

  const { data: steps, error } = await supabase
    .from('automation_steps')
    .select('*')
    .eq('automation_id', automationId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Could not load the steps: ${error.message}`);

  return { automation, steps: steps ?? [] };
}

const RECENT_RUNS_LIMIT = 20;

export async function listRecentRuns(supabase: Supabase, automationId: string): Promise<AutomationRun[]> {
  const { data, error } = await supabase
    .from('automation_runs')
    .select('*')
    .eq('automation_id', automationId)
    .order('started_at', { ascending: false })
    .limit(RECENT_RUNS_LIMIT);

  if (error) throw new Error(`Could not load run history: ${error.message}`);
  return data ?? [];
}

/** Every step for a batch of runs, for the run-history table's expandable rows. */
export async function listRunStepsForRuns(
  supabase: Supabase,
  runIds: string[],
): Promise<Map<string, AutomationRunStep[]>> {
  if (runIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('automation_run_steps')
    .select('*')
    .in('run_id', runIds)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Could not load run steps: ${error.message}`);

  const byRun = new Map<string, AutomationRunStep[]>();
  for (const step of data ?? []) {
    const existing = byRun.get(step.run_id) ?? [];
    existing.push(step);
    byRun.set(step.run_id, existing);
  }
  return byRun;
}

export interface RunDetail {
  run: AutomationRun;
  steps: AutomationRunStep[];
}

export async function getRunDetail(supabase: Supabase, runId: string): Promise<RunDetail | null> {
  const { data: run } = await supabase.from('automation_runs').select('*').eq('id', runId).maybeSingle();
  if (!run) return null;

  const { data: steps, error } = await supabase
    .from('automation_run_steps')
    .select('*')
    .eq('run_id', runId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Could not load the run's steps: ${error.message}`);

  return { run, steps: steps ?? [] };
}

export async function listApiKeys(supabase: Supabase): Promise<ApiKeyRow[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load API keys: ${error.message}`);
  return data ?? [];
}
