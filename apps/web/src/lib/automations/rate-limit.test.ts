import { describe, expect, it } from 'vitest';
import { checkRateLimit } from './rate-limit';
import { createFakeAdmin, createFakeStore } from './test-fake-admin';

const NOW = new Date('2026-08-13T15:00:00.000Z');

function runRow(overrides: Partial<{ status: string; started_at: string }>) {
  return {
    id: `run-${Math.random()}`,
    automation_id: 'automation-1',
    status: 'succeeded',
    skip_reason: null,
    started_at: NOW.toISOString(),
    ...overrides,
  };
}

describe('checkRateLimit', () => {
  it('allows an unlimited automation regardless of run count', async () => {
    const store = createFakeStore();
    store.tables.automation_runs = [runRow({}), runRow({}), runRow({})];

    const result = await checkRateLimit(createFakeAdmin(store), { id: 'automation-1', max_runs_per_day: null }, NOW);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBeNull();
  });

  it("counts today's succeeded, failed, and running attempts against the limit", async () => {
    const store = createFakeStore();
    store.tables.automation_runs = [
      runRow({ status: 'succeeded' }),
      runRow({ status: 'failed' }),
      runRow({ status: 'running' }),
    ];

    const result = await checkRateLimit(createFakeAdmin(store), { id: 'automation-1', max_runs_per_day: 3 }, NOW);
    expect(result.runsToday).toBe(3);
    expect(result.allowed).toBe(false);
  });

  it('does NOT count skipped or cancelled runs — a rate-limited or disabled automation cannot lock itself out further', async () => {
    const store = createFakeStore();
    store.tables.automation_runs = [
      runRow({ status: 'skipped' }),
      runRow({ status: 'skipped' }),
      runRow({ status: 'cancelled' }),
      runRow({ status: 'succeeded' }),
    ];

    const result = await checkRateLimit(createFakeAdmin(store), { id: 'automation-1', max_runs_per_day: 2 }, NOW);
    expect(result.runsToday).toBe(1);
    expect(result.allowed).toBe(true);
  });

  it('ignores runs from a previous day', async () => {
    const store = createFakeStore();
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
    store.tables.automation_runs = [
      runRow({ status: 'succeeded', started_at: yesterday }),
      runRow({ status: 'succeeded', started_at: yesterday }),
    ];

    const result = await checkRateLimit(createFakeAdmin(store), { id: 'automation-1', max_runs_per_day: 1 }, NOW);
    expect(result.runsToday).toBe(0);
    expect(result.allowed).toBe(true);
  });
});
