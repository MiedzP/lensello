import { describe, expect, it } from 'vitest';
import { buildCampaignTaskInserts } from './apply';
import type { PlaybookTaskRow } from './types';

function task(overrides: Partial<PlaybookTaskRow>): PlaybookTaskRow {
  return {
    id: 'task-1',
    playbook_id: 'playbook-1',
    day_offset: 0,
    title: 'Do the thing',
    detail: null,
    kind: 'admin',
    platform: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildCampaignTaskInserts', () => {
  const MON_WED_FRI = [1, 3, 5];

  it('copies every field by value, not by reference', () => {
    const rows = buildCampaignTaskInserts({
      campaignId: 'campaign-1',
      startsOn: '2026-09-14', // a Monday
      postingDays: MON_WED_FRI,
      postingTime: '09:00:00',
      playbookTasks: [
        task({ id: 't1', title: 'Book the stand', detail: 'Call the venue', kind: 'admin', day_offset: -21 }),
      ],
    });

    expect(rows).toEqual([
      {
        campaign_id: 'campaign-1',
        playbook_task_id: 't1',
        title: 'Book the stand',
        detail: 'Call the venue',
        kind: 'admin',
        due_on: '2026-08-24',
        due_time: null,
        client_id: null,
        post_id: null,
        assigned_to: null,
        sort_order: 0,
      },
    ]);
  });

  it('applies the campaign posting time to post and story tasks only', () => {
    const rows = buildCampaignTaskInserts({
      campaignId: 'campaign-1',
      startsOn: '2026-09-14',
      postingDays: MON_WED_FRI,
      postingTime: '09:00:00',
      playbookTasks: [
        task({ id: 'post-1', kind: 'post', day_offset: 0 }),
        task({ id: 'story-1', kind: 'story', day_offset: 0 }),
        task({ id: 'admin-1', kind: 'admin', day_offset: 0 }),
      ],
    });

    expect(rows.find((r) => r.playbook_task_id === 'post-1')?.due_time).toBe('09:00:00');
    expect(rows.find((r) => r.playbook_task_id === 'story-1')?.due_time).toBe('09:00:00');
    expect(rows.find((r) => r.playbook_task_id === 'admin-1')?.due_time).toBeNull();
  });

  it('snaps post tasks onto the campaign posting days', () => {
    const rows = buildCampaignTaskInserts({
      campaignId: 'campaign-1',
      // 2026-09-15 is a Tuesday — not a posting day.
      startsOn: '2026-09-15',
      postingDays: MON_WED_FRI,
      postingTime: '09:00:00',
      playbookTasks: [task({ id: 'post-1', kind: 'post', day_offset: 0 })],
    });

    expect(rows[0]?.due_on).toBe('2026-09-16'); // next Wednesday
  });

  it('skips playbook tasks already copied into this campaign', () => {
    const rows = buildCampaignTaskInserts({
      campaignId: 'campaign-1',
      startsOn: '2026-09-14',
      postingDays: MON_WED_FRI,
      postingTime: '09:00:00',
      playbookTasks: [
        task({ id: 't1' }),
        task({ id: 't2' }),
      ],
      alreadyCopied: new Set(['t1']),
    });

    expect(rows.map((r) => r.playbook_task_id)).toEqual(['t2']);
  });

  it('is idempotent when re-run with everything already copied', () => {
    const tasks = [task({ id: 't1' }), task({ id: 't2' })];
    const rows = buildCampaignTaskInserts({
      campaignId: 'campaign-1',
      startsOn: '2026-09-14',
      postingDays: MON_WED_FRI,
      postingTime: '09:00:00',
      playbookTasks: tasks,
      alreadyCopied: new Set(['t1', 't2']),
    });

    expect(rows).toEqual([]);
  });

  it('sanitizes a malformed posting_days array rather than crashing', () => {
    const rows = buildCampaignTaskInserts({
      campaignId: 'campaign-1',
      startsOn: '2026-09-14',
      postingDays: [1, 3, 5, 9, -2],
      postingTime: '09:00:00',
      playbookTasks: [task({ id: 'post-1', kind: 'post', day_offset: 1 })],
    });

    // day_offset 1 from Monday 2026-09-14 is Tuesday 2026-09-15, snapped to
    // Wednesday 2026-09-16 once the out-of-range days are dropped.
    expect(rows[0]?.due_on).toBe('2026-09-16');
  });

  it('preserves sort_order from the template', () => {
    const rows = buildCampaignTaskInserts({
      campaignId: 'campaign-1',
      startsOn: '2026-09-14',
      postingDays: MON_WED_FRI,
      postingTime: '09:00:00',
      playbookTasks: [task({ id: 't1', sort_order: 4 })],
    });

    expect(rows[0]?.sort_order).toBe(4);
  });
});
