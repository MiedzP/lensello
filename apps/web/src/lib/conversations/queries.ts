/**
 * Read helpers for the Conversations module.
 *
 * Same note as `lib/clients/queries.ts`: every table here declares
 * `Relationships: []` in `db.types.ts`, so an embedded `select` cannot be
 * typed. Related rows are fetched with a second `.in(...)` query and stitched
 * together in this file — one extra round trip, full type safety, no casts.
 */

import type { Session } from '@/lib/auth';
import type { Tables } from '@/lib/db.types';
import type { ClientStage } from '@lensello/core';
import { groupOrphanedMessages, type OrphanMessage } from './threading';
import type { ConversationStatus, MessageChannel } from './channels';

type Supabase = Session['supabase'];

export type ConversationRow = Tables<'conversations'>;
export type MessageRow = Tables<'messages'>;
export type ContactIdentityRow = Tables<'contact_identities'>;
export type ClientRow = Tables<'clients'>;
export type ProfileRow = Tables<'profiles'>;
export type SocialHandleRow = Tables<'client_social_handles'>;

/** A single studio's inbox, not an enterprise one. */
const LIST_LIMIT = 200;
const THREAD_LIMIT = 500;
/** Cap on the message rows pulled purely to build list previews / tallies. */
const TALLY_LIMIT = 5000;
/** Messages that predate threading, pulled for the defensive backfill below. */
const ORPHAN_LIMIT = 500;

// --- keeping every message threaded, defensively ------------------------

/**
 * Finds messages with no `conversation_id` and threads them, exactly like
 * `messages_assign_conversation` does in
 * 20260813130300_conversations_followup.sql.
 *
 * This is a safety net, not the primary mechanism — the trigger and its
 * migration-time backfill handle the ordinary case, including every message
 * `fileInboundMessages` and `syncSocialMessages` file, without either of
 * those modules knowing threading exists. This exists only for a message that
 * somehow reaches the table through a path the trigger does not cover.
 * Best-effort: a failure here must never stop the inbox from rendering.
 */
async function backfillOrphanedMessages(supabase: Supabase): Promise<void> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, client_id, channel, direction, sent_at, is_handled')
    .is('conversation_id', null)
    .limit(ORPHAN_LIMIT);

  if (error || !data || data.length === 0) return;

  const groups = groupOrphanedMessages(data as OrphanMessage[]);

  for (const group of groups) {
    const channel = group.channel as MessageChannel;

    // Reuse an existing thread for this client + channel if one already
    // exists (the ordinary path already created it); only start a new one
    // when there truly is none.
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('client_id', group.clientId)
      .eq('channel', channel)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    let conversationId = existing?.id ?? null;

    if (!conversationId) {
      const { data: created } = await supabase
        .from('conversations')
        .insert({
          client_id: group.clientId,
          channel,
          last_message_at: group.lastMessageAt,
          last_inbound_at: group.lastInboundAt,
          unread_count: group.unreadCount,
        })
        .select('id')
        .maybeSingle();
      conversationId = created?.id ?? null;
    }

    if (!conversationId) continue;

    await supabase
      .from('messages')
      .update({ conversation_id: conversationId })
      .in(
        'id',
        group.messages.map((message) => message.id),
      );
  }
}

// --- the inbox list -------------------------------------------------------

export interface InboxFilters {
  channel: MessageChannel | null;
  status: ConversationStatus | null;
  assignedTo: string | null;
}

export interface ConversationListItem {
  conversation: ConversationRow;
  clientId: string;
  clientName: string;
  clientStage: ClientStage;
  previewSubject: string | null;
  previewBody: string | null;
  assignedToName: string | null;
}

export async function listConversations(
  supabase: Supabase,
  filters: InboxFilters,
): Promise<{ items: ConversationListItem[]; error: string | null }> {
  await backfillOrphanedMessages(supabase);

  let query = supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);

  if (filters.channel) query = query.eq('channel', filters.channel);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);

  const { data: conversations, error } = await query;
  if (error) return { items: [], error: error.message };
  if (!conversations || conversations.length === 0) return { items: [], error: null };

  const clientIds = [...new Set(conversations.map((c) => c.client_id))];
  const conversationIds = conversations.map((c) => c.id);
  const assigneeIds = [
    ...new Set(
      conversations
        .map((c) => c.assigned_to)
        .filter((id): id is string => id !== null),
    ),
  ];

  const [{ data: clients }, { data: previews }, { data: assignees }] = await Promise.all([
    supabase.from('clients').select('id, name, stage').in('id', clientIds),
    supabase
      .from('messages')
      .select('conversation_id, subject, body, sent_at')
      .in('conversation_id', conversationIds)
      .order('sent_at', { ascending: false })
      .limit(TALLY_LIMIT),
    assigneeIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', assigneeIds)
      : Promise.resolve({ data: [] as Pick<ProfileRow, 'id' | 'full_name'>[] }),
  ]);

  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));
  const assigneeById = new Map((assignees ?? []).map((a) => [a.id, a.full_name]));

  // `previews` is sorted newest-first across every conversation, so the first
  // row seen per conversation_id is that conversation's latest message.
  const previewByConversation = new Map<
    string,
    { subject: string | null; body: string }
  >();
  for (const row of previews ?? []) {
    if (!row.conversation_id || previewByConversation.has(row.conversation_id)) continue;
    previewByConversation.set(row.conversation_id, { subject: row.subject, body: row.body });
  }

  const items = conversations.flatMap<ConversationListItem>((conversation) => {
    const client = clientById.get(conversation.client_id);
    // A conversation whose client vanished (cascade delete) is not renderable.
    if (!client) return [];

    const preview = previewByConversation.get(conversation.id);
    return [
      {
        conversation,
        clientId: client.id,
        clientName: client.name,
        clientStage: client.stage as ClientStage,
        previewSubject: preview?.subject ?? null,
        previewBody: preview?.body ?? null,
        assignedToName: conversation.assigned_to
          ? assigneeById.get(conversation.assigned_to) ?? null
          : null,
      },
    ];
  });

  return { items, error: null };
}

/** Cheap tallies for the filter chips: how many open threads per channel, etc. */
export interface InboxFacets {
  channelCounts: Partial<Record<MessageChannel, number>>;
  statusCounts: Partial<Record<ConversationStatus, number>>;
}

export async function getInboxFacets(supabase: Supabase): Promise<InboxFacets> {
  const { data } = await supabase
    .from('conversations')
    .select('channel, status')
    .limit(TALLY_LIMIT);

  const channelCounts: Partial<Record<MessageChannel, number>> = {};
  const statusCounts: Partial<Record<ConversationStatus, number>> = {};

  for (const row of data ?? []) {
    channelCounts[row.channel] = (channelCounts[row.channel] ?? 0) + 1;
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  }

  return { channelCounts, statusCounts };
}

export async function listAssignableStaff(supabase: Supabase): Promise<ProfileRow[]> {
  const { data } = await supabase.from('profiles').select('*').order('full_name');
  return data ?? [];
}

// --- the open thread + CRM panel -----------------------------------------

export interface ConversationDetail {
  conversation: ConversationRow;
  client: ClientRow;
  /** Oldest first — a conversation reads top to bottom. */
  thread: MessageRow[];
  identities: ContactIdentityRow[];
  socialHandles: SocialHandleRow[];
  recentGigs: Pick<Tables<'gigs'>, 'id' | 'title' | 'status' | 'starts_at'>[];
  recentGalleries: Pick<Tables<'galleries'>, 'id' | 'title' | 'created_at' | 'shoot_id'>[];
}

export async function getConversationDetail(
  supabase: Supabase,
  conversationId: string,
): Promise<ConversationDetail | null> {
  const { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation) return null;

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', conversation.client_id)
    .maybeSingle();

  // The thread points at a client that no longer exists (cascade delete raced
  // with this read). There is nothing coherent left to show.
  if (!client) return null;

  const [{ data: thread }, { data: identities }, { data: socialHandles }, { data: gigs }, { data: galleries }] =
    await Promise.all([
      supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(THREAD_LIMIT),
      supabase
        .from('contact_identities')
        .select('*')
        .eq('client_id', client.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase.from('client_social_handles').select('*').eq('client_id', client.id),
      supabase
        .from('gigs')
        .select('id, title, status, starts_at')
        .eq('client_id', client.id)
        .order('starts_at', { ascending: false })
        .limit(5),
      supabase
        .from('galleries')
        .select('id, title, created_at, shoot_id')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

  return {
    conversation,
    client,
    thread: thread ?? [],
    identities: identities ?? [],
    socialHandles: socialHandles ?? [],
    recentGigs: gigs ?? [],
    recentGalleries: galleries ?? [],
  };
}

/** Zeroes the unread badge. Called once the thread has actually rendered on screen. */
export async function markConversationRead(
  supabase: Supabase,
  conversationId: string,
): Promise<void> {
  await supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)
    .gt('unread_count', 0);
}

/** For the "merge onto a client" picker: a short, name/email match, nothing more. */
export async function searchClients(
  supabase: Supabase,
  query: string,
): Promise<Pick<ClientRow, 'id' | 'name' | 'email' | 'stage'>[]> {
  // `,` and `(` are the PostgREST `.or()` filter DSL's own syntax — stripped so
  // a pasted string cannot be read as a second condition rather than a search
  // term. Staff can already read every client row regardless, so this is a
  // correctness fix for the search, not a security boundary.
  const safe = query.replace(/[,()]/g, ' ').trim();
  if (!safe) return [];

  const { data } = await supabase
    .from('clients')
    .select('id, name, email, stage')
    .or(`name.ilike.%${safe}%,email.ilike.%${safe}%`)
    .order('name')
    .limit(10);

  return data ?? [];
}
