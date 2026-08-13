import type { Metadata } from 'next';
import { Inbox } from 'lucide-react';
import { z } from 'zod';
import { EmptyState, ErrorNote, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import {
  CONVERSATION_STATUSES,
  MESSAGE_CHANNELS,
  type ConversationStatus,
  type MessageChannel,
} from '@/lib/conversations/channels';
import {
  getConversationDetail,
  getInboxFacets,
  listAssignableStaff,
  listConversations,
} from '@/lib/conversations/queries';
import { ConversationFilters } from './components/conversation-filters';
import { ConversationList } from './components/conversation-list';
import { ThreadPanel } from './components/thread-panel';

export const metadata: Metadata = { title: 'Inbox' };

/** searchParams values arrive as `string | string[] | undefined`. */
function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseChannel(value: string | string[] | undefined): MessageChannel | null {
  const raw = first(value);
  return (MESSAGE_CHANNELS as readonly string[]).includes(raw ?? '')
    ? (raw as MessageChannel)
    : null;
}

function parseStatusParam(value: string | string[] | undefined): string | null {
  const raw = first(value);
  if (raw === 'all') return 'all';
  return (CONVERSATION_STATUSES as readonly string[]).includes(raw ?? '')
    ? (raw as ConversationStatus)
    : null;
}

export default async function ConversationsPage(props: PageProps<'/conversations'>) {
  const { supabase } = await requireUserOrRedirect();
  // Async in Next 16 — searchParams is a Promise.
  const searchParams = await props.searchParams;

  const channel = parseChannel(searchParams.channel);
  // The default is the working set — open threads — not everything ever
  // filed. "All" is one chip away, deliberately, same reasoning as the
  // Clients module's unhandled-inbox default.
  const statusParam = parseStatusParam(searchParams.status);
  const status: ConversationStatus | null =
    statusParam === 'all' ? null : (statusParam as ConversationStatus | null) ?? 'open';
  const assignedTo = first(searchParams.assignee);
  const selectedId = first(searchParams.id);

  const [{ items, error }, facets, staff] = await Promise.all([
    listConversations(supabase, { channel, status, assignedTo }),
    getInboxFacets(supabase),
    listAssignableStaff(supabase),
  ]);

  const selectedIsUuid = selectedId ? z.uuid().safeParse(selectedId).success : false;
  const detail = selectedIsUuid ? await getConversationDetail(supabase, selectedId!) : null;

  const linkQuery =
    (channel ? `&channel=${channel}` : '') +
    (statusParam ? `&status=${statusParam}` : '') +
    (assignedTo ? `&assignee=${assignedTo}` : '');

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Every conversation — email, DMs, SMS and comments — in one place."
      />

      <ConversationFilters
        channel={channel}
        status={status}
        statusParam={statusParam}
        assignedTo={assignedTo}
        facets={facets}
        staff={staff}
      />

      {error ? (
        <ErrorNote>Could not load the inbox: {error}</ErrorNote>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <ConversationList items={items} selectedId={selectedId} linkQuery={linkQuery} />

          <div>
            {detail ? (
              <ThreadPanel detail={detail} staff={staff} />
            ) : selectedId ? (
              <EmptyState
                icon={<Inbox size={22} aria-hidden="true" />}
                title="That conversation is gone"
                description="It may have been merged into another thread, or the client record was removed."
              />
            ) : (
              <EmptyState
                icon={<Inbox size={22} aria-hidden="true" />}
                title="Select a conversation"
                description="Pick a thread on the left to see the conversation and this person's full record."
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
