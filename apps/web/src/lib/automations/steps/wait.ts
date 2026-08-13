/**
 * `wait` — pauses briefly before the next step.
 *
 * Capped at 30 seconds by the schema (`waitConfigSchema`) and enforced again
 * here. There is no job queue behind this runner: a run is one HTTP request
 * from event to last step, bounded by the platform's function timeout. A
 * "wait 3 days" step cannot be honoured by sleeping — the request would be
 * killed long before — so the honest design is a short, real, in-process
 * delay, with anything longer refused at save time rather than silently
 * truncated at run time. If a workflow genuinely needs a multi-day gap, that
 * is two automations connected by a `schedule` or `*_upcoming` trigger, not
 * one automation with a wait step in the middle.
 */
import { waitConfigSchema } from '../schemas';
import { parseStepConfig, type StepExecutor } from './exec-types';

export const wait: StepExecutor = async ({ step }) => {
  const config = parseStepConfig(waitConfigSchema, step.config);
  await new Promise((resolve) => setTimeout(resolve, config.seconds * 1000));
  return { output: { waitedSeconds: config.seconds } };
};
