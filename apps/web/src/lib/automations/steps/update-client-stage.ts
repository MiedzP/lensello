/**
 * `update_client_stage` — moves the client to another pipeline stage.
 *
 * This is the one action that can re-trigger the automation system: changing
 * a stage is exactly what `client_stage_changed` fires on, and this write
 * happens through this module's own admin client rather than through
 * `clients/actions.ts` (which this agent may not edit). Chaining into
 * `dispatchAutomationEvent` after a successful update — with the causation
 * chain and loop guard — is handled by the runner right after this executor
 * returns, not here; see `runner.ts`.
 */

import { updateClientStageConfigSchema } from '../schemas';
import { parseStepConfig, type StepExecutor } from './exec-types';

export const updateClientStage: StepExecutor = async ({ admin, step, context }) => {
  const config = parseStepConfig(updateClientStageConfigSchema, step.config);

  if (!context.client) {
    throw new Error('No client is attached to this run, so there is no stage to change.');
  }

  const fromStage = context.client.stage;

  const { error } = await admin
    .from('clients')
    .update({ stage: config.toStage })
    .eq('id', context.client.id);

  if (error) throw new Error(`Could not change the stage: ${error.message}`);

  // Keeps the in-memory context correct for any later step in this same run
  // that reads `client.stage` (a branch condition, a template placeholder).
  context.client.stage = config.toStage;

  return { output: { clientId: context.client.id, fromStage, toStage: config.toStage } };
};
