/**
 * `branch` — checks a condition and, when it fails, skips a fixed number of
 * following steps.
 *
 * There is no general expression language and no goto: the step just names a
 * dotted field (`client.stage`), an operator, and how many *following* rows
 * in this automation's ordered step list to mark `skipped` when the check
 * fails. That is enough for "only text if this is a wedding" without turning
 * the step editor into a programming language. The skip count is applied by
 * the runner, which is the only place that knows the full step list and their
 * positions — this executor only reports the verdict.
 */
import type { Json } from '@/lib/db.types';
import { getPath } from '../template';
import { templateVars } from '../context';
import { branchConfigSchema } from '../schemas';
import { parseStepConfig, type StepExecutor } from './exec-types';

/** `getPath` can return an object (a whole client row); only a JSON scalar is worth recording. */
function toJsonScalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function evaluate(operator: string, actual: unknown, expected: string | undefined): boolean {
  switch (operator) {
    case 'exists':
      return actual !== null && actual !== undefined && actual !== '';
    case 'not_exists':
      return actual === null || actual === undefined || actual === '';
    case 'equals':
      return String(actual ?? '') === (expected ?? '');
    case 'not_equals':
      return String(actual ?? '') !== (expected ?? '');
    case 'contains':
      return String(actual ?? '').toLowerCase().includes((expected ?? '').toLowerCase());
    default:
      return false;
  }
}

export const branch: StepExecutor = async ({ step, context }) => {
  const config = parseStepConfig(branchConfigSchema, step.config);
  const actual = getPath(templateVars(context), config.field);
  const matched = evaluate(config.operator, actual, config.value);

  const output: Json = {
    field: config.field,
    operator: config.operator,
    actual: toJsonScalar(actual),
    matched,
  };

  return { output, skipNext: matched ? 0 : config.skipCount };
};
