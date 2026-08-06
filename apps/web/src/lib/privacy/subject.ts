/**
 * Data-subject access and erasure.
 *
 * Two obligations under UK GDPR that the app previously had no way to honour:
 * tell a person everything you hold about them, and delete it on request.
 *
 * Erasure here is deliberately *not* "delete everything the client ever
 * touched". A shoot and a gig are the studio's own business records, kept for
 * contractual and tax reasons that erasure does not override — the right is to
 * have personal data removed, not to have the other party's accounts rewritten.
 * So the personal record and its correspondence go, the business records stay
 * with the personal link severed, and the UI says exactly that rather than
 * implying more.
 */

import type { Session } from '@/lib/auth';
import type { Tables } from '@/lib/db.types';

type Supabase = Session['supabase'];

export interface SubjectExport {
  exportedAt: string;
  client: Tables<'clients'>;
  messages: Array<Pick<Tables<'messages'>, 'direction' | 'channel' | 'subject' | 'body' | 'sent_at'>>;
  socialHandles: Array<Pick<Tables<'client_social_handles'>, 'platform' | 'handle'>>;
  consents: Array<
    Pick<Tables<'client_consents'>, 'purpose' | 'granted' | 'source' | 'evidence' | 'created_at'>
  >;
  gigs: Array<Pick<Tables<'gigs'>, 'title' | 'type' | 'status' | 'starts_at' | 'location'>>;
  shoots: Array<Pick<Tables<'shoots'>, 'title' | 'type' | 'status' | 'shot_at'>>;
}

/**
 * Everything held about one person, in one object.
 *
 * Includes the business records, because a subject access request covers all
 * personal data — the fact that a gig is also a business record does not make
 * their name and location on it invisible. Erasure and access have different
 * scopes on purpose.
 */
export async function exportSubject(
  supabase: Supabase,
  clientId: string,
): Promise<SubjectExport | null> {
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .maybeSingle();

  if (!client) return null;

  const [messages, handles, consents, gigs, shoots] = await Promise.all([
    supabase
      .from('messages')
      .select('direction, channel, subject, body, sent_at')
      .eq('client_id', clientId)
      .order('sent_at'),
    supabase
      .from('client_social_handles')
      .select('platform, handle')
      .eq('client_id', clientId),
    supabase
      .from('client_consents')
      .select('purpose, granted, source, evidence, created_at')
      .eq('client_id', clientId)
      .order('created_at'),
    supabase
      .from('gigs')
      .select('title, type, status, starts_at, location')
      .eq('client_id', clientId)
      .order('starts_at'),
    supabase
      .from('shoots')
      .select('title, type, status, shot_at')
      .eq('client_id', clientId)
      .order('shot_at'),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    client,
    messages: messages.data ?? [],
    socialHandles: handles.data ?? [],
    consents: consents.data ?? [],
    gigs: gigs.data ?? [],
    shoots: shoots.data ?? [],
  };
}

export interface ErasureResult {
  messagesDeleted: number;
  gigsRetained: number;
  shootsRetained: number;
}

/**
 * Erases the personal record and everything that is purely personal data.
 *
 * `gigs.client_id` and `shoots.client_id` are `on delete set null`, so deleting
 * the client severs the link and leaves the business record standing — which is
 * the intended outcome, not an accident of the schema. The counts are returned
 * so the confirmation can tell the operator exactly what was kept, and so the
 * audit row records it.
 *
 * What this does not do is scrub a person's name out of a gig title or a shoot
 * note somebody typed by hand. That is a real limitation and the UI says so:
 * free text has to be reviewed by a human, because only a human can tell the
 * difference between a client's name and a venue's.
 */
export async function eraseSubject(
  supabase: Supabase,
  clientId: string,
): Promise<ErasureResult> {
  const [{ count: messageCount }, { count: gigCount }, { count: shootCount }] =
    await Promise.all([
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId),
      supabase
        .from('gigs')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId),
      supabase
        .from('shoots')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId),
    ]);

  // One delete. `messages`, `client_social_handles`, and `client_consents` all
  // cascade; `gigs` and `shoots` null their link. Doing it in pieces would
  // leave a half-erased subject if any step failed.
  const { error } = await supabase.from('clients').delete().eq('id', clientId);

  if (error) {
    throw new Error(`Could not erase the client record: ${error.message}`);
  }

  return {
    messagesDeleted: messageCount ?? 0,
    gigsRetained: gigCount ?? 0,
    shootsRetained: shootCount ?? 0,
  };
}
