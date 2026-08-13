import { describe, expect, it } from 'vitest';
import { groupOrphanedMessages, orphanGroupKey, type OrphanMessage } from './threading';

function message(overrides: Partial<OrphanMessage> & { id: string }): OrphanMessage {
  return {
    client_id: 'client-1',
    channel: 'email',
    direction: 'inbound',
    sent_at: '2026-01-01T00:00:00.000Z',
    is_handled: false,
    ...overrides,
  };
}

describe('groupOrphanedMessages', () => {
  it('groups messages by client + channel, not by client alone', () => {
    const groups = groupOrphanedMessages([
      message({ id: 'a', client_id: 'client-1', channel: 'email' }),
      message({ id: 'b', client_id: 'client-1', channel: 'instagram' }),
      message({ id: 'c', client_id: 'client-1', channel: 'email' }),
    ]);

    expect(groups).toHaveLength(2);
    const emailGroup = groups.find((g) => g.channel === 'email')!;
    expect(emailGroup.messages.map((m) => m.id)).toEqual(['a', 'c']);
  });

  it('does not fold two different clients on the same channel together', () => {
    const groups = groupOrphanedMessages([
      message({ id: 'a', client_id: 'client-1', channel: 'sms' }),
      message({ id: 'b', client_id: 'client-2', channel: 'sms' }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('orders messages within a group oldest first, like a real thread', () => {
    const groups = groupOrphanedMessages([
      message({ id: 'newer', sent_at: '2026-02-01T00:00:00.000Z' }),
      message({ id: 'older', sent_at: '2026-01-01T00:00:00.000Z' }),
    ]);

    expect(groups[0]!.messages.map((m) => m.id)).toEqual(['older', 'newer']);
  });

  it('orders groups newest-message-first, matching the inbox default sort', () => {
    const groups = groupOrphanedMessages([
      message({ id: 'stale', client_id: 'client-1', sent_at: '2026-01-01T00:00:00.000Z' }),
      message({ id: 'fresh', client_id: 'client-2', sent_at: '2026-03-01T00:00:00.000Z' }),
    ]);

    expect(groups.map((g) => g.clientId)).toEqual(['client-2', 'client-1']);
  });

  it('counts unread as unhandled inbound, and ignores outbound for that count', () => {
    const groups = groupOrphanedMessages([
      message({ id: 'a', direction: 'inbound', is_handled: false }),
      message({ id: 'b', direction: 'inbound', is_handled: true }),
      message({ id: 'c', direction: 'outbound', is_handled: false }),
    ]);

    expect(groups[0]!.unreadCount).toBe(1);
  });

  it('tracks last_inbound_at separately from last_message_at', () => {
    const groups = groupOrphanedMessages([
      message({ id: 'a', direction: 'inbound', sent_at: '2026-01-01T00:00:00.000Z' }),
      message({ id: 'b', direction: 'outbound', sent_at: '2026-02-01T00:00:00.000Z' }),
    ]);

    expect(groups[0]!.lastMessageAt).toBe('2026-02-01T00:00:00.000Z');
    expect(groups[0]!.lastInboundAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('drops a message with no client, rather than grouping it under a guess', () => {
    const groups = groupOrphanedMessages([
      message({ id: 'a', client_id: '' }),
      message({ id: 'b' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.messages.map((m) => m.id)).toEqual(['b']);
  });

  it('returns nothing for an empty input', () => {
    expect(groupOrphanedMessages([])).toEqual([]);
  });
});

describe('orphanGroupKey', () => {
  it('is the same composite the trigger and the migration backfill group by', () => {
    expect(orphanGroupKey('client-1', 'email')).toBe('client-1::email');
  });

  it('does not collide across a client/channel boundary', () => {
    // Different pairs of (client, channel) that could concatenate to the same
    // string if the separator were empty or absent.
    const a = orphanGroupKey('client-1', 'x');
    const b = orphanGroupKey('client-1x', '');
    expect(a).not.toBe(b);
  });
});
