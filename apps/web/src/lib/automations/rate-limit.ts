/**
 * `max_runs_per_day`, enforced before a single step executes.
 *
 * "Before", not "after", is the whole point: the brief is explicit that this
 * must be checked before executing any step, because a check that runs after
 * the fact has already sent the fiftieth email by the time it fires. The
 * runner calls this first, ahead of loading steps or building context.
 *
 * Only `running`, `succeeded`, and `failed` runs count against the limit.
 * Skipped runs are not attempts — an automation sitting at its limit still
 * gets a recorded (and harmless) skip for every event that reaches it, and
 * counting those would mean the limit throttles itself into never resetting
 * within the day. `cancelled` is likewise excluded; nothing currently
 * produces it, but a future manual-abort feature should not silently tighten
 * the limit either.
 */

import type { createAdminClient } from '@/lib/supabase/admin';
import type { Automation } from './types';

type Admin = ReturnType<typeof createAdminClient>;

const COUNTED_STATUSES = ['running', 'succeeded', 'failed'] as const;

function startOfUtcDay(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

export interface RateLimitCheck {
  allowed: boolean;
  runsToday: number;
  limit: number | null;
}

export async function checkRateLimit(
  admin: Admin,
  automation: Pick<Automation, 'id' | 'max_runs_per_day'>,
  now: Date = new Date(),
): Promise<RateLimitCheck> {
  if (automation.max_runs_per_day === null) {
    return { allowed: true, runsToday: 0, limit: null };
  }

  const { count } = await admin
    .from('automation_runs')
    .select('id', { count: 'exact', head: true })
    .eq('automation_id', automation.id)
    .in('status', COUNTED_STATUSES)
    .gte('started_at', startOfUtcDay(now));

  const runsToday = count ?? 0;
  return {
    allowed: runsToday < automation.max_runs_per_day,
    runsToday,
    limit: automation.max_runs_per_day,
  };
}
