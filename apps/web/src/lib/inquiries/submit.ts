/**
 * Handling a public inquiry.
 *
 * Runs with the service role, because the form is unauthenticated and every
 * table it touches is behind `is_staff()`. That makes this the most
 * security-sensitive module in the app: it is the only path where input from a
 * stranger reaches the database. Everything written here comes from
 * `inquirySchema` — nothing is passed through unvalidated.
 *
 * A submission is filed as an inbound message so it lands in the same reply
 * queue as everything else. The alternative — a separate "inquiries" inbox —
 * would mean two places to check, and the second one always goes unchecked.
 */

import { createHash } from 'node:crypto';
import { SHOOT_TYPE_LABELS } from '@lensello/core';
import { findConflictingGigs } from '@/lib/gigs/queries';
import type { TablesInsert } from '@/lib/db.types';
import type { createAdminClient } from '@/lib/supabase/admin';
import {
  BUDGET_LABELS,
  MARKETING_CONSENT_WORDING,
  type InquiryInput,
} from './schema';

type Admin = ReturnType<typeof createAdminClient>;

/** Generous for a real studio, tight enough to make scripted abuse pointless. */
const MAX_PER_HOUR = 5;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * A shoot has no duration at inquiry time, so availability is checked across
 * the whole requested day. A client asking about the 14th cares whether the
 * day is taken, not whether a specific eight-hour window is.
 */
function dayBounds(date: string): { startsAt: string; endsAt: string } {
  return {
    startsAt: `${date}T00:00:00.000Z`,
    endsAt: `${date}T23:59:59.999Z`,
  };
}

/**
 * Salted hash of the caller's address.
 *
 * Salted with the encryption key so the hashes are not a rainbow-table lookup
 * away from the original addresses. Rate limiting needs to recognise a repeat
 * visitor; it does not need to know who they are, and storing that would make
 * this table a log of everyone who ever looked at the studio's form.
 */
export function hashIp(ip: string): string {
  const salt = process.env.LENSELLO_ENCRYPTION_KEY ?? 'lensello';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

export class InquiryThrottled extends Error {
  constructor() {
    super('Too many inquiries from this connection. Please try again later.');
    this.name = 'InquiryThrottled';
  }
}

async function enforceThrottle(admin: Admin, ipHash: string): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const { count } = await admin
    .from('inquiry_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);

  if ((count ?? 0) >= MAX_PER_HOUR) throw new InquiryThrottled();

  await admin.from('inquiry_attempts').insert({ ip_hash: ipHash });

  // Prune opportunistically rather than on a schedule: the table only exists
  // to answer "how many recently", so anything outside every window is dead
  // weight, and this keeps it from growing without a cron to look after it.
  await admin
    .from('inquiry_attempts')
    .delete()
    .lt('created_at', new Date(Date.now() - WINDOW_MS * 24).toISOString());
}

/** The message body, as a human would want to read it in the reply queue. */
function composeBody(input: InquiryInput): string {
  const lines: string[] = [
    `Shoot type: ${SHOOT_TYPE_LABELS[input.shootType]}`,
    input.date ? `Requested date: ${input.date}` : 'Requested date: not given',
  ];

  if (input.headcount !== undefined) lines.push(`Headcount: ${input.headcount}`);
  if (input.budget) lines.push(`Budget: ${BUDGET_LABELS[input.budget]}`);
  if (input.phone) lines.push(`Phone: ${input.phone}`);

  lines.push('', input.message);
  return lines.join('\n');
}

export interface InquiryOutcome {
  clientId: string;
  isNewClient: boolean;
  /** Null when no date was given. */
  dateAvailable: boolean | null;
  conflictCount: number;
}

export async function submitInquiry(
  admin: Admin,
  input: InquiryInput,
  ip: string,
): Promise<InquiryOutcome> {
  await enforceThrottle(admin, hashIp(ip));

  const email = input.email.toLowerCase();

  const { data: existing } = await admin
    .from('clients')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let clientId = existing?.id ?? null;
  const isNewClient = clientId === null;

  if (!clientId) {
    const row: TablesInsert<'clients'> = {
      name: input.name,
      email,
      phone: input.phone ?? null,
      stage: 'lead',
      source: 'website',
    };

    // ignoreDuplicates, NOT a plain upsert. A plain upsert UPDATES on conflict,
    // which would overwrite the name, phone, source and — worst — reset `stage`
    // to 'lead'. A client already marked 'booked' who fills the form in again
    // for a second shoot would be silently demoted, and the select above cannot
    // prevent it: a concurrent request can insert the row in between.
    const { data: created, error } = await admin
      .from('clients')
      .upsert(row, { onConflict: 'email', ignoreDuplicates: true })
      .select('id');

    if (error) {
      throw new Error(`Could not record the inquiry: ${error.message}`);
    }

    if (created?.[0]) {
      clientId = created[0].id;
    } else {
      // Lost the race: the row exists now, so read the winner rather than
      // failing an enquiry we could still file.
      const { data: raced } = await admin
        .from('clients')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (!raced) throw new Error('Could not record the inquiry: the client record vanished.');
      clientId = raced.id;
    }
  }
  // An existing client's stage is deliberately left alone. Somebody already
  // marked 'booked' who asks about a second shoot is not demoted to a lead.

  const message: TablesInsert<'messages'> = {
    client_id: clientId,
    direction: 'inbound',
    channel: 'form',
    subject: `${SHOOT_TYPE_LABELS[input.shootType]} inquiry`,
    body: composeBody(input),
    is_handled: false,
    is_ai_draft: false,
    // Namespaced like every other channel, and unique per submission so two
    // genuine inquiries from the same person are both kept.
    external_id: `form:${crypto.randomUUID()}`,
  };

  const { error: messageError } = await admin.from('messages').insert(message);
  if (messageError) {
    throw new Error(`Could not record the inquiry: ${messageError.message}`);
  }

  // Only recorded when granted. An unticked box is the absence of consent,
  // not a withdrawal of it, and writing `granted: false` here would overwrite a
  // consent this person gave on an earlier enquiry.
  if (input.marketingConsent) {
    await admin.from('client_consents').insert({
      client_id: clientId,
      purpose: 'marketing',
      granted: true,
      source: 'inquiry_form',
      evidence: MARKETING_CONSENT_WORDING,
      ip_hash: hashIp(ip),
    });
  }

  let dateAvailable: boolean | null = null;
  let conflictCount = 0;

  if (input.date) {
    // Best effort. A failed availability check must not lose the inquiry —
    // the message is already filed, and an unanswered "is this date free"
    // is a question for a human anyway.
    try {
      const conflicts = await findConflictingGigs(admin, dayBounds(input.date));
      conflictCount = conflicts.length;
      dateAvailable = conflicts.length === 0;
    } catch (cause) {
      console.error('[inquiry] availability check failed', cause);
    }
  }

  return { clientId, isNewClient, dateAvailable, conflictCount };
}
