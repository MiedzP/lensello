import type { z } from 'zod';
import type { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/db.types';
import type { Automation, AutomationStep, RunContext } from '../types';

/**
 * Config is stored as `jsonb` and was validated by the matching schema when
 * the step was last saved — but the schema can change under an old row (a
 * default added, a field renamed), so every executor re-parses rather than
 * casting. A step that fails to parse is a step whose editor needs opening
 * and re-saving, which is a clearer failure than a `TypeError` deep inside a
 * template render.
 */
export function parseStepConfig<T>(schema: z.ZodType<T>, config: unknown): T {
  const parsed = schema.safeParse(config ?? {});
  if (!parsed.success) {
    throw new Error(
      `This step's saved configuration is no longer valid: ${parsed.error.issues[0]?.message ?? 'unknown problem'}. Open the step and save it again.`,
    );
  }
  return parsed.data;
}

export type Admin = ReturnType<typeof createAdminClient>;

export interface StepExecInput {
  admin: Admin;
  automation: Pick<Automation, 'id' | 'name'>;
  step: AutomationStep;
  context: RunContext;
  /** This automation's id is already appended — a step that itself causes a new trigger passes this straight through. */
  chain: string[];
}

export interface StepExecResult {
  output: Json;
  /** Branch only: how many following steps the runner marks `skipped`. */
  skipNext?: number;
}

export type StepExecutor = (input: StepExecInput) => Promise<StepExecResult>;
