import Link from 'next/link';
import type { Route } from 'next';
import { Inbox } from 'lucide-react';
import { Badge, Card, EmptyState } from '@/components/ui';
import { CLIENT_STAGE_LABELS } from '@lensello/core';
import { age, fullDateTime, snippet } from '@/lib/clients/format';
import { CLIENT_STAGE_TONES } from '@/lib/clients/stages';
import { CHANNEL_LABELS, CHANNEL_TONES } from '@/lib/conversations/channels';
import type { ConversationListItem } from '@/lib/conversations/queries';
import { cn } from '@/lib/utils';

/** The thread list, newest first. Unread state and channel are told apart at a glance. */
export function ConversationList({
  items,
  selectedId,
  linkQuery,
}: {
  items: ConversationListItem[];
  selectedId: string | null;
  /** The other active filters, so opening a thread does not reset them. */
  linkQuery: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={24} aria-hidden="true" />}
        title="Nothing here"
        description="No conversation matches these filters. Try clearing one, or sync the inbox from Clients or Connections."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-subtle">
        {items.map((item) => {
          const isSelected = item.conversation.id === selectedId;
          const isUnread = item.conversation.unread_count > 0;
          const href = `/conversations?id=${item.conversation.id}${linkQuery}` as Route;

          return (
            <li key={item.conversation.id}>
              <Link
                href={href}
                className={cn(
                  'block px-4 py-3 transition-colors hover:bg-surface-hover',
                  isSelected && 'bg-accent-subtle',
                )}
                aria-current={isSelected ? 'true' : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'truncate text-sm',
                      isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground',
                    )}
                  >
                    {item.clientName}
                  </span>
                  <span
                    className="shrink-0 text-xs text-faint"
                    title={item.conversation.last_message_at ? fullDateTime(item.conversation.last_message_at) : undefined}
                  >
                    {item.conversation.last_message_at ? age(item.conversation.last_message_at) : ''}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone={CHANNEL_TONES[item.conversation.channel]}>
                    {CHANNEL_LABELS[item.conversation.channel]}
                  </Badge>
                  <Badge tone={CLIENT_STAGE_TONES[item.clientStage]}>
                    {CLIENT_STAGE_LABELS[item.clientStage]}
                  </Badge>
                  {item.conversation.status !== 'open' ? (
                    <span className="text-xs text-faint capitalize">{item.conversation.status}</span>
                  ) : null}
                  {isUnread ? (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground">
                      {item.conversation.unread_count}
                    </span>
                  ) : null}
                </div>

                {item.previewBody ? (
                  <p className="mt-1 line-clamp-1 text-xs text-muted">
                    {snippet(item.previewBody, 100)}
                  </p>
                ) : null}

                {item.assignedToName ? (
                  <p className="mt-1 text-xs text-faint">Assigned to {item.assignedToName}</p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
