import Link from 'next/link';
import { Users } from 'lucide-react';
import { Badge, Card, EmptyState } from '@/components/ui';
import { CLIENT_STAGE_LABELS, type ClientStage } from '@lensello/core';
import { pluralize } from '@/lib/utils';
import type { ClientListItem } from '@/lib/clients/queries';
import { shortDate } from '@/lib/clients/format';
import { CLIENT_SOURCE_LABELS, CLIENT_STAGE_TONES } from '@/lib/clients/stages';
import { SyncInboxButton } from './sync-inbox-button';

/** The CRM view: everyone, with enough context to decide who to chase. */
export function ClientTable({
  items,
  stage,
}: {
  items: ClientListItem[];
  stage: ClientStage | null;
}) {
  if (items.length === 0) {
    // Two genuinely different empty states. "Nothing matches this filter" is a
    // dead end you back out of; "no clients at all" is a first-run state that
    // needs a way forward.
    return stage ? (
      <EmptyState
        icon={<Users size={26} aria-hidden="true" />}
        title={`No clients at the ${CLIENT_STAGE_LABELS[stage].toLowerCase()} stage`}
        description="Try another stage, or clear the filter to see everyone."
        action={
          <Link
            href="/clients?view=clients"
            className="text-sm font-medium text-accent hover:underline"
          >
            Show all clients
          </Link>
        }
      />
    ) : (
      <EmptyState
        icon={<Users size={26} aria-hidden="true" />}
        title="No clients yet"
        description="Syncing the inbox creates a client record for every new sender, so this list fills itself as inquiries arrive."
        action={<SyncInboxButton compact />}
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Wide content scrolls inside its own container rather than pushing the
          page sideways on a narrow screen. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="sr-only">
            Clients, most recently contacted first
          </caption>
          <thead>
            <tr className="border-b border-subtle text-left">
              <Th>Name</Th>
              <Th>Stage</Th>
              <Th>Source</Th>
              <Th>Last contacted</Th>
              <Th className="text-right">Messages</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {items.map(({ client, messageCount, unhandledCount }) => (
              <tr key={client.id} className="transition-colors hover:bg-surface-hover">
                <td className="px-5 py-3">
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-medium text-foreground hover:text-accent hover:underline"
                  >
                    {client.name}
                  </Link>
                  {client.email ? (
                    <p className="mt-0.5 truncate text-xs text-faint">{client.email}</p>
                  ) : null}
                </td>
                <td className="px-5 py-3">
                  <Badge tone={CLIENT_STAGE_TONES[client.stage]}>
                    {CLIENT_STAGE_LABELS[client.stage]}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-muted">
                  {CLIENT_SOURCE_LABELS[client.source]}
                </td>
                <td className="px-5 py-3 text-muted">
                  {shortDate(client.last_contacted_at)}
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="tabular-nums text-muted">{messageCount}</span>
                  {unhandledCount > 0 ? (
                    <span className="ml-2 align-middle">
                      <Badge tone="accent">
                        {pluralize(unhandledCount, 'waiting', 'waiting')}
                      </Badge>
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-5 py-2.5 text-xs font-medium tracking-wide text-faint uppercase ${className ?? ''}`}
    >
      {children}
    </th>
  );
}
