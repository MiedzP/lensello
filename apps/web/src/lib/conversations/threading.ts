/**
 * Grouping for messages with no `conversation_id`.
 *
 * `messages.conversation_id` is nullable, and every row written before
 * 20260813120300_conversations.sql has none. The migration's own follow-up
 * (20260813130300_conversations_followup.sql) backfills those rows and a
 * trigger threads everything from then on, so in the ordinary case this
 * function never runs against anything.
 *
 * It exists for the case that is not ordinary: a row that reaches `messages`
 * through some path that bypasses the trigger, such as a restored backup, a
 * direct `insert` run by hand, or a future write path nobody has written yet.
 * Grouping by client + channel is the same rule the trigger and the
 * migration's SQL backfill use, kept here as a plain function so
 * `queries.ts` can run it defensively at read time and so the rule itself is
 * unit-testable without a database.
 */

export interface OrphanMessage {
  id: string;
  client_id: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  sent_at: string;
  is_handled: boolean;
}

export interface OrphanGroup {
  /** Stable key for the group: what a conversation for it would be keyed on. */
  key: string;
  clientId: string;
  channel: string;
  /** Oldest first - a conversation reads top to bottom. */
  messages: OrphanMessage[];
  lastMessageAt: string;
  lastInboundAt: string | null;
  unreadCount: number;
}

const KEY_SEPARATOR = '::';

/** Same composite key `messages_assign_conversation` groups new rows by. */
export function orphanGroupKey(clientId: string, channel: string): string {
  return `${clientId}${KEY_SEPARATOR}${channel}`;
}

/**
 * Groups orphaned messages by client + channel, newest group first.
 *
 * Messages missing a `client_id` or `channel` are unrenderable - there is no
 * client to file them under - and are dropped rather than grouped under a
 * guess, the same choice `listUnhandledInbound` makes for a message whose
 * client vanished.
 */
export function groupOrphanedMessages(
  messages: readonly OrphanMessage[],
): OrphanGroup[] {
  const groups = new Map<string, OrphanGroup>();

  for (const message of messages) {
    if (!message.client_id || !message.channel) continue;

    const key = orphanGroupKey(message.client_id, message.channel);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        clientId: message.client_id,
        channel: message.channel,
        messages: [],
        lastMessageAt: message.sent_at,
        lastInboundAt: null,
        unreadCount: 0,
      };
      groups.set(key, group);
    }

    group.messages.push(message);
    if (message.sent_at > group.lastMessageAt) group.lastMessageAt = message.sent_at;
    if (message.direction === 'inbound') {
      if (!group.lastInboundAt || message.sent_at > group.lastInboundAt) {
        group.lastInboundAt = message.sent_at;
      }
      if (!message.is_handled) group.unreadCount += 1;
    }
  }

  for (const group of groups.values()) {
    group.messages.sort((a, b) => a.sent_at.localeCompare(b.sent_at));
  }

  return [...groups.values()].sort((a, b) =>
    b.lastMessageAt.localeCompare(a.lastMessageAt),
  );
}
