/**
 * Read helpers for the Clients module.
 *
 * All of them take an already-authenticated Supabase client so the caller
 * decides how the session was resolved (`requireUserOrRedirect` in a page,
 * `requireUser` in an action) and every query still runs under the caller's RLS
 * context.
 *
 * Note on joins: `db.types.ts` declares `Relationships: []` for every table, so
 * supabase-js cannot type an embedded select like `messages(client:clients(*))`.
 * Related rows are therefore fetched with a second `.in(...)` query and stitched
 * together here — one extra round trip, full type safety, no casts.
 */

import type { Session } from '@/lib/auth';
import type { Tables } from '@/lib/db.types';
import type { ClientStage, DateOnly } from '@lensello/core';

type Supabase = Session['supabase'];

export type ClientRow = Tables<'clients'>;
export type MessageRow = Tables<'messages'>;

/** Cap on any one list read. A single studio's CRM, not an enterprise inbox. */
const LIST_LIMIT = 100;
/** Cap on the message rows pulled purely to tally per-client counts. */
const TALLY_LIMIT = 5000;

export interface InboxItem {
  message: MessageRow;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientStage: ClientStage;
}

export interface ClientListItem {
  client: ClientRow;
  messageCount: number;
  unhandledCount: number;
}

/**
 * The work queue: inbound messages nobody has dealt with, newest first.
 *
 * Matches `messages_unhandled_idx` (partial on `direction = 'inbound' and not
 * is_handled`, ordered by `sent_at desc`) exactly, so this is an index-only
 * range scan rather than a filtered table scan.
 */
export async function listUnhandledInbound(
  supabase: Supabase,
): Promise<{ items: InboxItem[]; error: string | null }> {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('direction', 'inbound')
    .eq('is_handled', false)
    .order('sent_at', { ascending: false })
    .limit(LIST_LIMIT);

  if (error) return { items: [], error: error.message };
  if (!messages || messages.length === 0) return { items: [], error: null };

  const clientIds = [...new Set(messages.map((message) => message.client_id))];
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, email, stage')
    .in('id', clientIds);

  if (clientsError) return { items: [], error: clientsError.message };

  const byId = new Map((clients ?? []).map((client) => [client.id, client]));

  // An unhandled message whose client vanished (cascade delete) is not
  // renderable, so it is dropped rather than shown as "unknown".
  const items = messages.flatMap<InboxItem>((message) => {
    const client = byId.get(message.client_id);
    if (!client) return [];
    return [
      {
        message,
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        clientStage: client.stage as ClientStage,
      },
    ];
  });

  return { items, error: null };
}

/** Count for the header badge. `head: true` fetches no rows. */
export async function countUnhandled(supabase: Supabase): Promise<number> {
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'inbound')
    .eq('is_handled', false);
  return count ?? 0;
}

/** The CRM list, optionally narrowed to one stage. */
export async function listClients(
  supabase: Supabase,
  stage: ClientStage | null,
): Promise<{ items: ClientListItem[]; error: string | null }> {
  let query = supabase
    .from('clients')
    .select('*')
    .order('last_contacted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);

  if (stage) query = query.eq('stage', stage);

  const { data: clients, error } = await query;
  if (error) return { items: [], error: error.message };
  if (!clients || clients.length === 0) return { items: [], error: null };

  const counts = await tallyMessages(
    supabase,
    clients.map((client) => client.id),
  );

  return {
    items: clients.map((client) => ({
      client,
      messageCount: counts.get(client.id)?.total ?? 0,
      unhandledCount: counts.get(client.id)?.unhandled ?? 0,
    })),
    error: null,
  };
}

/**
 * Per-client message counts.
 *
 * PostgREST cannot GROUP BY, and an embedded `messages(count)` aggregate is
 * untypeable here (see the note at the top of the file), so the ids are pulled
 * for the visible page only and tallied in memory. At studio scale that is a
 * few hundred rows; `TALLY_LIMIT` keeps a pathological case from becoming an
 * unbounded read.
 */
async function tallyMessages(
  supabase: Supabase,
  clientIds: string[],
): Promise<Map<string, { total: number; unhandled: number }>> {
  const tally = new Map<string, { total: number; unhandled: number }>();
  if (clientIds.length === 0) return tally;

  const { data } = await supabase
    .from('messages')
    .select('client_id, direction, is_handled')
    .in('client_id', clientIds)
    .limit(TALLY_LIMIT);

  for (const row of data ?? []) {
    const entry = tally.get(row.client_id) ?? { total: 0, unhandled: 0 };
    entry.total += 1;
    if (row.direction === 'inbound' && !row.is_handled) entry.unhandled += 1;
    tally.set(row.client_id, entry);
  }

  return tally;
}

export interface ClientDetail {
  client: ClientRow;
  /** Oldest first — a conversation reads top to bottom. */
  thread: MessageRow[];
}

export async function getClientDetail(
  supabase: Supabase,
  clientId: string,
): Promise<ClientDetail | null> {
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .maybeSingle();

  if (!client) return null;

  const { data: thread } = await supabase
    .from('messages')
    .select('*')
    .eq('client_id', clientId)
    .order('sent_at', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(500);

  return { client, thread: thread ?? [] };
}

/**
 * Gig statuses that make a date unavailable.
 *
 * Deliberately excludes `inquiry`. `buildClientReplyPrompt` renders
 * `isDateAvailable: false` as "the requested date is already booked", and an
 * unanswered inquiry from someone else is not a booking — telling a client the
 * date is gone on that basis would be the untrue statement the prompt exists to
 * prevent. A `hold` does block: a tentatively held date is genuinely not open.
 */
const BLOCKING_GIG_STATUSES = ['hold', 'confirmed'] as const;

/**
 * Is the studio free on this date?
 *
 * Reads the `gigs` table, which the Gigs module owns — read-only, and the only
 * cross-module dependency in this file.
 *
 * The day is bounded in UTC. A shoot starting within an hour of local midnight
 * could in principle land on the neighbouring day; that is a knowingly accepted
 * approximation, and it is why the answer is shown to the photographer as a
 * visible statement rather than quietly folded into an email.
 */
export async function isDateAvailable(
  supabase: Supabase,
  date: DateOnly,
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('gigs')
    .select('id')
    .in('status', BLOCKING_GIG_STATUSES)
    // Overlap test: the gig starts before the day ends and ends after it starts.
    .lte('starts_at', `${date}T23:59:59.999Z`)
    .gte('ends_at', `${date}T00:00:00.000Z`)
    .limit(1);

  // A failed read is unknown, not "available". Claiming a date is open on the
  // strength of a query that errored is exactly the kind of invented fact the
  // reply prompt forbids.
  if (error) return null;
  return (data ?? []).length === 0;
}

/**
 * The gigs that make a date unavailable, so the photographer can see *why*
 * rather than just being told a yes or a no. Same status filter as
 * `isDateAvailable`, so the banner and the fact given to the model agree.
 */
export async function gigsOnDate(
  supabase: Supabase,
  date: DateOnly,
): Promise<Pick<Tables<'gigs'>, 'id' | 'title' | 'starts_at' | 'status'>[]> {
  const { data } = await supabase
    .from('gigs')
    .select('id, title, starts_at, status')
    .in('status', BLOCKING_GIG_STATUSES)
    .lte('starts_at', `${date}T23:59:59.999Z`)
    .gte('ends_at', `${date}T00:00:00.000Z`)
    .order('starts_at', { ascending: true })
    .limit(5);

  return data ?? [];
}
