import { beforeEach, describe, expect, it } from 'vitest';
import { runAutomation } from './runner';
import { createFakeAdmin, createFakeStore, type FakeStore } from './test-fake-admin';
import type { Automation, AutomationStep } from './types';

function makeAutomation(overrides: Partial<Automation> = {}): Automation {
  return {
    id: overrides.id ?? 'automation-1',
    name: overrides.name ?? 'Test automation',
    description: null,
    trigger_kind: 'manual',
    trigger_config: {},
    enabled: true,
    max_runs_per_day: null,
    last_run_at: null,
    run_count: 0,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeStep(overrides: Partial<AutomationStep>): AutomationStep {
  return {
    id: overrides.id ?? `step-${Math.random()}`,
    automation_id: overrides.automation_id ?? 'automation-1',
    sort_order: overrides.sort_order ?? 0,
    action_kind: overrides.action_kind ?? 'branch',
    config: overrides.config ?? {},
    continue_on_error: overrides.continue_on_error ?? false,
    created_at: new Date().toISOString(),
  };
}

/** Always matches, never skips — a deterministic no-op step for ordering tests. */
function alwaysMatchesBranch(sortOrder: number, automationId: string): AutomationStep {
  return makeStep({
    automation_id: automationId,
    sort_order: sortOrder,
    action_kind: 'branch',
    config: { field: 'automation.name', operator: 'exists', skipCount: 1 },
  });
}

let store: FakeStore;

beforeEach(() => {
  store = createFakeStore();
});

function seedSteps(steps: AutomationStep[]): void {
  store.tables.automation_steps = steps;
}

describe('runAutomation — ordering', () => {
  it('runs steps in ascending sort_order and records one row per step', async () => {
    const automation = makeAutomation();
    seedSteps([
      alwaysMatchesBranch(2, automation.id),
      alwaysMatchesBranch(0, automation.id),
      alwaysMatchesBranch(1, automation.id),
    ]);

    const admin = createFakeAdmin(store);
    const outcome = await runAutomation(admin, automation, { chain: [] });

    expect(outcome.status).toBe('succeeded');

    const runSteps = store.tables.automation_run_steps as Array<{ sort_order: number; status: string }>;
    expect(runSteps).toHaveLength(3);
    expect(runSteps.map((step) => step.sort_order)).toEqual([0, 1, 2]);
    expect(runSteps.every((step) => step.status === 'succeeded')).toBe(true);
  });
});

describe('runAutomation — continue_on_error', () => {
  it('stops the run and skips remaining steps when continue_on_error is false', async () => {
    const automation = makeAutomation();
    seedSteps([
      makeStep({ automation_id: automation.id, sort_order: 0, action_kind: 'add_tag', continue_on_error: false }),
      alwaysMatchesBranch(1, automation.id),
    ]);

    const admin = createFakeAdmin(store);
    const outcome = await runAutomation(admin, automation, { chain: [] });

    expect(outcome.status).toBe('failed');

    const runSteps = store.tables.automation_run_steps as Array<{ status: string; error?: string }>;
    expect(runSteps[0]!.status).toBe('failed');
    expect(runSteps[0]!.error).toMatch(/not available yet/);
    expect(runSteps[1]!.status).toBe('skipped');
  });

  it('keeps running and still succeeds overall when continue_on_error is true', async () => {
    const automation = makeAutomation();
    seedSteps([
      makeStep({ automation_id: automation.id, sort_order: 0, action_kind: 'add_tag', continue_on_error: true }),
      alwaysMatchesBranch(1, automation.id),
    ]);

    const admin = createFakeAdmin(store);
    const outcome = await runAutomation(admin, automation, { chain: [] });

    expect(outcome.status).toBe('succeeded');

    const runSteps = store.tables.automation_run_steps as Array<{ status: string }>;
    expect(runSteps[0]!.status).toBe('failed');
    expect(runSteps[1]!.status).toBe('succeeded');
  });
});

describe('runAutomation — rate limiting', () => {
  it('enforces max_runs_per_day before any step executes, and records the skip', async () => {
    const automation = makeAutomation({ max_runs_per_day: 1 });
    seedSteps([alwaysMatchesBranch(0, automation.id)]);

    const admin = createFakeAdmin(store);

    const first = await runAutomation(admin, automation, { chain: [] });
    expect(first.status).toBe('succeeded');

    const second = await runAutomation(admin, automation, { chain: [] });
    expect(second.status).toBe('skipped');

    const runs = store.tables.automation_runs as Array<{ status: string; skip_reason: string | null }>;
    const skippedRun = runs.find((run) => run.status === 'skipped');
    expect(skippedRun?.skip_reason).toBe('rate_limited');

    // The second run must not have executed the step at all.
    const runSteps = store.tables.automation_run_steps as unknown[];
    expect(runSteps).toHaveLength(1);
  });
});

describe('runAutomation — disabled', () => {
  it('never executes a step for a disabled automation, and records why', async () => {
    const automation = makeAutomation({ enabled: false });
    seedSteps([alwaysMatchesBranch(0, automation.id)]);

    const admin = createFakeAdmin(store);
    const outcome = await runAutomation(admin, automation, { chain: [] });

    expect(outcome.status).toBe('skipped');
    expect(store.tables.automation_run_steps ?? []).toHaveLength(0);

    const runs = store.tables.automation_runs as Array<{ skip_reason: string | null }>;
    expect(runs[0]!.skip_reason).toBe('disabled');
  });
});

describe('runAutomation — loop protection', () => {
  it('detects an automation whose own action re-triggers itself, and stops before a second real run', async () => {
    const automation = makeAutomation({
      id: 'loopy',
      trigger_kind: 'client_stage_changed',
      trigger_config: {},
    });
    seedSteps([
      makeStep({
        automation_id: automation.id,
        sort_order: 0,
        action_kind: 'update_client_stage',
        config: { toStage: 'booked' },
      }),
    ]);
    store.tables.automations = [automation];
    store.tables.clients = [
      { id: 'client-1', name: 'Test Client', email: 'test@example.com', stage: 'quoted', marketing_consent: false },
    ];

    const admin = createFakeAdmin(store);
    const outcome = await runAutomation(admin, automation, { triggerPayload: { clientId: 'client-1' }, chain: [] });

    expect(outcome.status).toBe('succeeded');

    // The client stage actually changed once...
    expect(store.tables.clients[0]!.stage).toBe('booked');

    // ...and the chained client_stage_changed dispatch found this same
    // automation as a candidate, but the loop guard stopped it rather than
    // running the update_client_stage step a second time.
    const runs = store.tables.automation_runs as Array<{ automation_id: string; status: string; skip_reason: string | null }>;
    const runsForThisAutomation = runs.filter((run) => run.automation_id === automation.id);
    expect(runsForThisAutomation).toHaveLength(2);
    expect(runsForThisAutomation[1]!.status).toBe('skipped');
    expect(runsForThisAutomation[1]!.skip_reason).toBe('loop_detected');

    // Only one update_client_stage step ever actually ran.
    const stageSteps = (store.tables.automation_run_steps as Array<{ action_kind: string }>).filter(
      (step) => step.action_kind === 'update_client_stage',
    );
    expect(stageSteps).toHaveLength(1);
  });
});
