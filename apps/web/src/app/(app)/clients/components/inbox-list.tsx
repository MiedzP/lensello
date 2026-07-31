import Link from 'next/link';
import { ChevronRight, Inbox } from 'lucide-react';
import { Badge, Card, EmptyState } from '@/components/ui';
import { CLIENT_STAGE_LABELS } from '@lensello/core';
import type { InboxItem } from '@/lib/clients/queries';
import { age, fullDateTime, snippet } from '@/lib/clients/format';
import { CLIENT_STAGE_TONES } from '@/lib/clients/stages';
import { SyncInboxButton } from './sync-inbox-button';

/** The work queue. Newest first, one row per message that still needs a reply. */
export function InboxList({ items }: { items: InboxItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={26} aria-hidden="true" />}
        title="Inbox zero"
        description="Nothing is waiting on a reply. New inquiries land here when you sync."
        action={<SyncInboxButton compact />}
      />
    );
  }

  return (
    <Card>
      <ul className="divide-y divide-subtle">
        {items.map((item) => (
          <li key={item.message.id}>
            <Link
              href={`/clients/${item.clientId}`}
              className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-surface-hover"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {item.clientName}
                  </span>
                  <Badge tone={CLIENT_STAGE_TONES[item.clientStage]}>
                    {CLIENT_STAGE_LABELS[item.clientStage]}
                  </Badge>
                  <span
                    className="text-xs text-faint"
                    title={fullDateTime(item.message.sent_at)}
                  >
                    {age(item.message.sent_at)}
                  </span>
                </div>

                <p className="mt-1 truncate text-sm font-medium text-foreground">
                  {item.message.subject ?? '(no subject)'}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                  {snippet(item.message.body)}
                </p>
              </div>

              <span className="mt-0.5 flex shrink-0 items-center gap-1 text-xs font-medium text-muted group-hover:text-accent">
                Open and reply
                <ChevronRight size={14} aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
