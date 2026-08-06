/**
 * Social inbox sync: pull DMs, comments, and mentions through the adapter and
 * file them against clients.
 *
 * Same idempotency contract as the mail sync in lib/clients/sync.ts — this is a
 * button a human presses, so it will be pressed twice and it will be pressed
 * while a previous run is in flight. Two unique keys carry that:
 *
 *  - `messages.external_id` (unique) — the provider's message id, namespaced
 *    per platform so an Instagram id can never collide with a mail id.
 *  - `client_social_handles (platform, handle)` (unique) — one client per
 *    identity per platform. This is the social equivalent of `clients.email`,
 *    which a DM does not have.
 *
 * Both are `ON CONFLICT` arbiters with ignore-duplicates, so a repeat is a
 * no-op decided by Postgres rather than by a check-then-write that two
 * concurrent requests can both pass.
 */

import {
  getIntegrations,
  type SocialMessage,
} from '@lensello/core/integrations';
import type { ClientSource, SocialPlatform } from '@lensello/core';
import type { Session } from '@/lib/auth';
import type { TablesInsert } from '@/lib/db.types';
import type { createAdminClient } from '@/lib/supabase/admin';
import {
  normalizeHandle,
  readAccessToken,
  type SocialAccountRow,
} from './queries';

type Supabase = Session['supabase'];
type Admin = ReturnType<typeof createAdminClient>;

export interface SocialSyncResult {
  platform: SocialPlatform;
  fetched: number;
  newClients: number;
  newMessages: number;
  /** Fetched but unusable — no parseable handle, or no provider id to dedupe on. */
  skipped: number;
}

/** Same rationale as the mail sync: provider clocks drift, so widen the window. */
const OVERLAP_MS = 24 * 60 * 60 * 1000;

/**
 * Only Instagram is a `clients.source` value. The others collapse to 'other'
 * rather than being bent into a near-enough bucket — a wrong attribution in
 * the CRM is worse than an honest "other" a human can correct.
 */
function sourceFor(platform: SocialPlatform): ClientSource {
  return platform === 'instagram' ? 'instagram' : 'other';
}

const KIND_LABEL: Record<SocialMessage['kind'], string> = {
  direct_message: 'DM',
  comment: 'comment',
  mention: 'mention',
};

function subjectFor(message: SocialMessage): string {
  const platform = message.platform[0]!.toUpperCase() + message.platform.slice(1);
  return `${platform} ${KIND_LABEL[message.kind]}`;
}

/**
 * The stored body.
 *
 * A comment without the post it is on is close to unanswerable, and there is no
 * column for the link, so it is appended with a visible separator rather than
 * silently dropped.
 */
function bodyFor(message: SocialMessage): string {
  if (!message.contextUrl) return message.body;
  return `${message.body}\n\n— on ${message.contextUrl}`;
}

/** Newest stored message for this channel, minus the overlap window. */
async function resolveSince(
  supabase: Supabase,
  platform: SocialPlatform,
): Promise<string | undefined> {
  const { data } = await supabase
    .from('messages')
    .select('sent_at')
    .eq('direction', 'inbound')
    .eq('channel', platform)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return undefined;
  const newest = new Date(data.sent_at).getTime();
  if (Number.isNaN(newest)) return undefined;
  return new Date(newest - OVERLAP_MS).toISOString();
}

/**
 * Resolves handles to client ids, creating clients for the ones we have never
 * seen. Returns only what it could resolve; the caller drops the rest rather
 * than filing a message under a guess.
 */
async function resolveClients(
  supabase: Supabase,
  platform: SocialPlatform,
  senders: Map<string, string>,
): Promise<{ ids: Map<string, string>; created: number }> {
  const handles = [...senders.keys()];
  const ids = new Map<string, string>();
  if (handles.length === 0) return { ids, created: 0 };

  const { data: existing } = await supabase
    .from('client_social_handles')
    .select('client_id, handle')
    .eq('platform', platform)
    .in('handle', handles);

  for (const row of existing ?? []) ids.set(row.handle, row.client_id);

  const missing = handles.filter((handle) => !ids.has(handle));
  if (missing.length === 0) return { ids, created: 0 };

  const clientRows: TablesInsert<'clients'>[] = missing.map((handle) => ({
    // A handle that has only ever messaged us is a lead. Promoting it is a
    // judgement call for a human, not for a sync job.
    name: senders.get(handle) || handle,
    stage: 'lead',
    source: sourceFor(platform),
  }));

  const { data: insertedClients, error: clientError } = await supabase
    .from('clients')
    .insert(clientRows)
    .select('id');

  if (clientError) {
    throw new Error(`Could not create clients for new senders: ${clientError.message}`);
  }

  const createdIds = (insertedClients ?? []).map((row) => row.id);

  const handleRows: TablesInsert<'client_social_handles'>[] = missing.map(
    (handle, index) => ({
      client_id: createdIds[index]!,
      platform,
      handle,
    }),
  );

  // ignoreDuplicates: a concurrent sync may have claimed the same handle
  // between the select above and this insert. Postgres arbitrates on
  // client_social_handles_key and the loser silently does nothing.
  const { error: handleError } = await supabase
    .from('client_social_handles')
    .upsert(handleRows, { onConflict: 'platform,handle', ignoreDuplicates: true });

  if (handleError) {
    throw new Error(`Could not record sender handles: ${handleError.message}`);
  }

  // Read back the authoritative mapping — for handles we won it is the client
  // just created, for handles we lost it is the other request's client.
  const { data: settled } = await supabase
    .from('client_social_handles')
    .select('client_id, handle')
    .eq('platform', platform)
    .in('handle', missing);

  for (const row of settled ?? []) ids.set(row.handle, row.client_id);

  // Any client created above that no handle actually points at lost the race
  // and would otherwise sit in the CRM forever as a nameless duplicate.
  const claimed = new Set(ids.values());
  const orphans = createdIds.filter((id) => !claimed.has(id));
  if (orphans.length > 0) {
    await supabase.from('clients').delete().in('id', orphans);
  }

  return { ids, created: createdIds.length - orphans.length };
}

export async function syncSocialMessages(
  supabase: Supabase,
  admin: Admin,
  account: SocialAccountRow,
): Promise<SocialSyncResult> {
  const platform = account.platform;
  const accessToken = await readAccessToken(admin, account.id);

  if (!accessToken) {
    // Recorded on the row so the connections page can say so without the user
    // having to press sync again to find out.
    await supabase
      .from('social_accounts')
      .update({
        status: 'expired',
        last_error: 'The stored token is missing or expired. Reconnect the account.',
      })
      .eq('id', account.id);

    throw new Error(
      `The ${platform} token has expired. Reconnect the account to resume syncing.`,
    );
  }

  const { social } = getIntegrations();
  const since = await resolveSince(supabase, platform);
  const fetched = await social.fetchMessages({ platform, accessToken, since });

  let skipped = 0;

  // Deduplicate within the payload as well as against the table: a provider can
  // return the same message twice in one page.
  const usable = new Map<string, { message: SocialMessage; handle: string }>();
  const senders = new Map<string, string>();

  for (const message of fetched) {
    const handle = normalizeHandle(message.fromHandle);
    const externalId = message.externalId?.trim();

    // Without a provider id there is no way to know on the next run whether we
    // already have this message, so filing it would guarantee duplicates.
    if (!handle || !externalId) {
      skipped += 1;
      continue;
    }
    if (usable.has(externalId)) continue;

    usable.set(externalId, { message, handle });
    if (!senders.has(handle)) senders.set(handle, message.fromName.trim() || handle);
  }

  const { ids, created } = await resolveClients(supabase, platform, senders);

  const rows: TablesInsert<'messages'>[] = [];
  for (const [externalId, { message, handle }] of usable) {
    const clientId = ids.get(handle);
    if (!clientId) {
      skipped += 1;
      continue;
    }
    rows.push({
      client_id: clientId,
      direction: 'inbound',
      channel: platform,
      subject: subjectFor(message),
      body: bodyFor(message),
      is_handled: false,
      is_ai_draft: false,
      sent_at: message.receivedAt,
      // Namespaced: `messages.external_id` is unique across every channel, and
      // a bare provider id could collide with a mail id.
      external_id: `${platform}:${externalId}`,
    });
  }

  let newMessages = 0;
  if (rows.length > 0) {
    const { data: inserted, error } = await supabase
      .from('messages')
      .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: true })
      .select('id');

    if (error) throw new Error(`Could not file the fetched messages: ${error.message}`);
    newMessages = (inserted ?? []).length;
  }

  await supabase
    .from('social_accounts')
    .update({ last_synced_at: new Date().toISOString(), last_error: null })
    .eq('id', account.id);

  return { platform, fetched: fetched.length, newClients: created, newMessages, skipped };
}
