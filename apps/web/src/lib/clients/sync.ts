/**
 * Inbox sync: pull inbound mail through the adapter and file it against clients.
 *
 * The whole design constraint is idempotency. Sync is a button a human presses,
 * so it *will* get pressed twice, and it will be pressed while a previous run is
 * still in flight. Running it N times must leave the same rows behind as
 * running it once.
 *
 * Two unique keys do that work:
 *
 *  - `messages.external_id` (unique, 20260731150000_init.sql) — the provider's message id.
 *  - `clients.email` (unique, 20260731150300_clients.sql) — one client per address.
 *
 * Both are used as `ON CONFLICT` arbiters with ignore-duplicates, so a repeat is
 * a no-op decided by Postgres rather than by a check-then-write in application
 * code that two concurrent requests can both pass.
 */

import type { InboundMessage } from '@lensello/core/integrations';
import { resolveMailClient } from '@/lib/mailboxes/queries';
import type { createAdminClient } from '@/lib/supabase/admin';
import type { ClientSource } from '@lensello/core';
import type { Session } from '@/lib/auth';
import type { TablesInsert } from '@/lib/db.types';
import { nameFromEmail } from './format';

type Supabase = Session['supabase'];
type Admin = ReturnType<typeof createAdminClient>;

export interface SyncResult {
  fetched: number;
  newClients: number;
  newMessages: number;
  /** Fetched but unusable — no parseable sender, or no provider id to dedupe on. */
  skipped: number;
}

/**
 * Overlap window on the incremental fetch.
 *
 * `since` is derived from the newest message already stored, but provider clocks
 * drift and messages can be indexed out of order, so the window is widened by a
 * day. Re-fetching a message that is already filed costs nothing — the
 * `external_id` conflict swallows it.
 */
const OVERLAP_MS = 24 * 60 * 60 * 1000;

/**
 * Emails are stored lower-cased and trimmed; the CHECK constraint added in
 * 20260731150300_clients.sql enforces it, and matching an inbound sender to an existing
 * client depends on it.
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim().toLowerCase();
  // Cheap structural check only. This is a matching key, not a deliverability
  // guarantee, and rejecting an odd-but-real address would lose the inquiry.
  if (!trimmed || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Where the inquiry came from, when the sender says so outright.
 *
 * Only explicit provenance counts — "found you on Instagram", "Sarah referred
 * us". Anything vaguer defaults to `website`, which is the honest answer for an
 * email that just arrived with no attribution. The value is CRM metadata a
 * human can correct on the client record, and it is deliberately not inferred
 * from anything as flimsy as the sender's mail provider.
 */
export function inferSource(message: Pick<InboundMessage, 'fromEmail' | 'subject' | 'body'>): ClientSource {
  const domain = message.fromEmail.split('@')[1]?.toLowerCase() ?? '';
  if (/(^|\.)weddingwire\./.test(domain)) return 'wedding_wire';

  const text = `${message.subject}\n${message.body}`.toLowerCase();

  // Ordered most specific first. A repeat client who also mentions Instagram is
  // still a repeat client.
  if (/\b(?:did|had|booked) a (?:session|shoot|shooting) with you\b/.test(text)) {
    return 'repeat';
  }
  if (/\b(?:shot with you|worked with you) (?:before|again)\b/.test(text)) return 'repeat';
  if (/\b(?:referred|recommended|referral)\b/.test(text)) return 'referral';
  if (/\bwedding\s?wire\b/.test(text)) return 'wedding_wire';
  if (/\b(?:instagram|insta)\b/.test(text)) return 'instagram';
  if (/\bgoogle\b/.test(text)) return 'google';

  return 'website';
}

/** Newest stored inbound message, minus the overlap window. */
async function resolveSince(supabase: Supabase): Promise<string | undefined> {
  const { data } = await supabase
    .from('messages')
    .select('sent_at')
    .eq('direction', 'inbound')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return undefined;
  const newest = new Date(data.sent_at).getTime();
  if (Number.isNaN(newest)) return undefined;
  return new Date(newest - OVERLAP_MS).toISOString();
}

/**
 * Resolves an email to a client id, creating the client when it is new.
 *
 * Returns the ids it could resolve. Anything it could not is reported by
 * absence, and the caller drops those messages rather than filing them under a
 * guess.
 */
async function resolveClients(
  supabase: Supabase,
  senders: Map<string, { name: string; source: ClientSource }>,
): Promise<{ ids: Map<string, string>; created: number }> {
  const emails = [...senders.keys()];
  const ids = new Map<string, string>();
  if (emails.length === 0) return { ids, created: 0 };

  const { data: existing } = await supabase
    .from('clients')
    .select('id, email')
    .in('email', emails);

  for (const row of existing ?? []) {
    if (row.email) ids.set(row.email, row.id);
  }

  const missing = emails.filter((email) => !ids.has(email));
  if (missing.length === 0) return { ids, created: 0 };

  const rows: TablesInsert<'clients'>[] = missing.map((email) => {
    const sender = senders.get(email)!;
    return {
      name: sender.name,
      email,
      // A brand new address that has only ever emailed us is a lead. Promoting
      // it to `inquiry` is a judgement call for a human, not for a sync job.
      stage: 'lead',
      source: sender.source,
    };
  });

  // ignoreDuplicates: another request (or another tab) may have created the
  // same client between the select above and this insert. Postgres arbitrates
  // on clients_email_unique and the loser silently does nothing.
  const { data: inserted, error } = await supabase
    .from('clients')
    .upsert(rows, { onConflict: 'email', ignoreDuplicates: true })
    .select('id, email');

  if (error) throw new Error(`Could not create clients for new senders: ${error.message}`);

  for (const row of inserted ?? []) {
    if (row.email) ids.set(row.email, row.id);
  }

  const created = (inserted ?? []).length;

  // Whatever is still unresolved lost the race, so it exists now — read it back.
  const stillMissing = missing.filter((email) => !ids.has(email));
  if (stillMissing.length > 0) {
    const { data: raced } = await supabase
      .from('clients')
      .select('id, email')
      .in('email', stillMissing);
    for (const row of raced ?? []) {
      if (row.email) ids.set(row.email, row.id);
    }
  }

  return { ids, created };
}

export async function syncInboundMail(
  supabase: Supabase,
  admin: Admin,
): Promise<SyncResult> {
  // The CONNECTED mailbox first, falling back to the registry. Going straight
  // to `getIntegrations()` here — which is what this did — meant a studio that
  // had connected its own mailbox would send replies from it and then never
  // read it, because sending and syncing resolved their client differently.
  // Half-connected, with nothing to indicate it.
  const { mail } = await resolveMailClient(supabase, admin);
  const since = await resolveSince(supabase);

  // Adapter only. Never `fetch()` a mail server from a module — swapping mock
  // for live has to stay a one-file change.
  const fetched = await mail.fetchInbox(since);

  return fileInboundMessages(supabase, fetched);
}

/**
 * Files already-fetched messages.
 *
 * Split from `syncInboundMail` so the inbound webhook can reuse it verbatim.
 * Mail now arrives two ways — pushed by the provider within seconds, and
 * pulled by the sync button — and both must land through this one function.
 * Two write paths would mean two chances to disagree about what counts as a
 * duplicate, and the whole idempotency argument above rests on there being
 * exactly one.
 */
export async function fileInboundMessages(
  supabase: Supabase,
  fetched: InboundMessage[],
): Promise<SyncResult> {
  let skipped = 0;

  // Deduplicate within the payload as well as against the table: a provider can
  // return the same message twice in one page, and `ON CONFLICT DO NOTHING`
  // arbitrating twice on the same key inside one statement is not worth relying
  // on when a Map does it for free.
  const usable = new Map<string, { message: InboundMessage; email: string }>();
  const senders = new Map<string, { name: string; source: ClientSource }>();

  for (const message of fetched) {
    const email = normalizeEmail(message.fromEmail);
    const externalId = message.externalId?.trim();

    // Without a provider id there is no way to know on the next run whether we
    // already have this message, so filing it would guarantee duplicates.
    if (!email || !externalId) {
      skipped += 1;
      continue;
    }
    if (usable.has(externalId)) continue;

    usable.set(externalId, { message, email });

    if (!senders.has(email)) {
      senders.set(email, {
        name: message.fromName.trim() || nameFromEmail(email),
        source: inferSource(message),
      });
    }
  }

  const { ids, created } = await resolveClients(supabase, senders);

  const rows: TablesInsert<'messages'>[] = [];
  for (const [externalId, { message, email }] of usable) {
    const clientId = ids.get(email);
    if (!clientId) {
      skipped += 1;
      continue;
    }
    rows.push({
      client_id: clientId,
      direction: 'inbound',
      subject: message.subject.trim() || null,
      body: message.body,
      // The whole point of the queue: freshly synced inbound mail needs a reply.
      is_handled: false,
      is_ai_draft: false,
      sent_at: message.receivedAt,
      external_id: externalId,
    });
  }

  let newMessages = 0;
  if (rows.length > 0) {
    const { data: inserted, error } = await supabase
      .from('messages')
      .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: true })
      .select('id');

    if (error) throw new Error(`Could not file the fetched messages: ${error.message}`);

    // With ignore-duplicates the representation contains only rows that were
    // actually inserted, which is exactly the "how many were new" answer.
    newMessages = (inserted ?? []).length;
  }

  return {
    fetched: fetched.length,
    newClients: created,
    newMessages,
    skipped,
  };
}
