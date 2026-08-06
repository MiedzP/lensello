'use server';

/**
 * Every mutation for the Clients module.
 *
 * Two rules hold everywhere in this file:
 *
 *  1. Each action starts with `await requireUser()`. Actions are reachable by
 *     direct POST; the fact that the UI only renders a button for staff proves
 *     nothing about who is calling. The returned `supabase` carries the caller's
 *     RLS context, and that — not this file — is the enforcement boundary.
 *  2. Everything from the browser is parsed before use, and everything from the
 *     model is parsed before it is persisted.
 *
 * On cache invalidation: `revalidatePath` rather than `updateTag`. `updateTag`
 * needs data tagged with `cacheTag`, which needs the `use cache` directive,
 * which needs `cacheComponents: true` in next.config.ts — not enabled in this
 * project, and next.config.ts is not this module's file to change. These reads
 * also go through a cookie-bound Supabase client, so they could not live inside
 * a `use cache` scope anyway. `revalidatePath` in a Server Function updates the
 * UI immediately for the path being viewed, which is the read-your-own-writes
 * behaviour the convention is after.
 */

import { revalidatePath } from 'next/cache';
import {
  IntegrationError,
  getIntegrations,
  type PublishResult,
} from '@lensello/core/integrations';
import type { ClientStage, SocialPlatform } from '@lensello/core';
import { requireUser, type Session } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveMailClient } from '@/lib/mailboxes/queries';
import {
  getPublishableAccount,
  readAccessToken,
} from '@/lib/connections/queries';
import type { Tables, TablesInsert } from '@/lib/db.types';
import { DraftError, draftClientReply, type UsedFacts } from '@/lib/clients/draft';
import {
  clientRecordSchema,
  draftRequestSchema,
  firstIssue,
  handledSchema,
  sendReplySchema,
  stageChangeSchema,
  type ReplyDraft,
} from '@/lib/clients/schemas';
import { suggestNextStage } from '@/lib/clients/stages';
import { syncInboundMail } from '@/lib/clients/sync';

/** Postgres unique-violation. Surfaced as a field error, not a stack trace. */
const UNIQUE_VIOLATION = '23505';

function revalidateClient(clientId: string): void {
  revalidatePath('/clients');
  revalidatePath(`/clients/${clientId}`);
}

// --- inbox sync ---------------------------------------------------------

export interface SyncState {
  summary: string | null;
  error: string | null;
  /** Changes on every run so the UI can react even to an identical result. */
  token: number;
}

export const INITIAL_SYNC: SyncState = { summary: null, error: null, token: 0 };

export async function syncInboxAction(previous: SyncState): Promise<SyncState> {
  const { supabase } = await requireUser();
  const token = previous.token + 1;

  try {
    const result = await syncInboundMail(supabase);
    revalidatePath('/clients');

    const parts: string[] = [];
    parts.push(
      result.newMessages === 0
        ? 'No new messages.'
        : `${result.newMessages} new ${result.newMessages === 1 ? 'message' : 'messages'}.`,
    );
    if (result.newClients > 0) {
      parts.push(
        `${result.newClients} new ${result.newClients === 1 ? 'client' : 'clients'} created.`,
      );
    }
    // Worth saying out loud: it means sync ran and correctly changed nothing.
    const alreadyFiled = Math.max(
      0,
      result.fetched - result.newMessages - result.skipped,
    );
    if (alreadyFiled > 0) parts.push(`${alreadyFiled} already filed.`);
    if (result.skipped > 0) {
      parts.push(
        `${result.skipped} skipped — no usable sender address or provider id.`,
      );
    }

    return { summary: parts.join(' '), error: null, token };
  } catch (cause) {
    if (cause instanceof IntegrationError) {
      return { summary: null, error: `${cause.provider}: ${cause.message}`, token };
    }
    return {
      summary: null,
      error:
        cause instanceof Error
          ? cause.message
          : 'The inbox sync failed. Please try again.',
      token,
    };
  }
}

// --- the client record --------------------------------------------------

export interface RecordState {
  saved: boolean;
  error: string | null;
  token: number;
}

export const INITIAL_RECORD: RecordState = { saved: false, error: null, token: 0 };

export async function updateClientAction(
  previous: RecordState,
  formData: FormData,
): Promise<RecordState> {
  const { supabase } = await requireUser();
  const token = previous.token + 1;

  const parsed = clientRecordSchema.safeParse({
    clientId: formData.get('clientId') ?? '',
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
    stage: formData.get('stage') ?? '',
    source: formData.get('source') ?? '',
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    return { saved: false, error: firstIssue(parsed.error), token };
  }

  const { clientId, ...fields } = parsed.data;

  // `last_contacted_at` is deliberately absent: an insert trigger on `messages`
  // maintains it, and writing it here would fight that trigger.
  const { error } = await supabase
    .from('clients')
    .update({
      name: fields.name,
      email: fields.email,
      phone: fields.phone,
      stage: fields.stage,
      source: fields.source,
      notes: fields.notes,
    })
    .eq('id', clientId);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        saved: false,
        error: 'Another client already uses that email address.',
        token,
      };
    }
    return { saved: false, error: `Could not save: ${error.message}`, token };
  }

  revalidateClient(clientId);
  return { saved: true, error: null, token };
}

export interface StageState {
  error: string | null;
  token: number;
}

export const INITIAL_STAGE: StageState = { error: null, token: 0 };

export async function setClientStageAction(
  previous: StageState,
  formData: FormData,
): Promise<StageState> {
  const { supabase } = await requireUser();
  const token = previous.token + 1;

  const parsed = stageChangeSchema.safeParse({
    clientId: formData.get('clientId') ?? '',
    stage: formData.get('stage') ?? '',
  });

  if (!parsed.success) return { error: firstIssue(parsed.error), token };

  const { error } = await supabase
    .from('clients')
    .update({ stage: parsed.data.stage })
    .eq('id', parsed.data.clientId);

  if (error) return { error: `Could not change the stage: ${error.message}`, token };

  revalidateClient(parsed.data.clientId);
  return { error: null, token };
}

// --- triage -------------------------------------------------------------

export interface HandledState {
  error: string | null;
  token: number;
}

export const INITIAL_HANDLED: HandledState = { error: null, token: 0 };

export async function setMessageHandledAction(
  previous: HandledState,
  formData: FormData,
): Promise<HandledState> {
  const { supabase } = await requireUser();
  const token = previous.token + 1;

  const parsed = handledSchema.safeParse({
    clientId: formData.get('clientId') ?? '',
    messageId: formData.get('messageId') ?? '',
    isHandled: formData.get('isHandled') ?? '',
  });

  if (!parsed.success) return { error: firstIssue(parsed.error), token };

  // Scoped to the client as well as the id: an action that will flip any row by
  // uuid alone is a wider surface than it needs to be, RLS or no RLS.
  const { error } = await supabase
    .from('messages')
    .update({ is_handled: parsed.data.isHandled })
    .eq('id', parsed.data.messageId)
    .eq('client_id', parsed.data.clientId);

  if (error) return { error: `Could not update the message: ${error.message}`, token };

  revalidateClient(parsed.data.clientId);
  return { error: null, token };
}

// --- AI drafting --------------------------------------------------------

export interface DraftResult {
  draft: ReplyDraft | null;
  usedFacts: UsedFacts | null;
  error: string | null;
}

/**
 * Produces a draft and returns it. Writes nothing.
 *
 * The draft lands in the composer as editable text. There is no code path from
 * here to `messages` — sending is a separate, human-initiated action.
 */
export async function draftReplyAction(formData: FormData): Promise<DraftResult> {
  const { supabase } = await requireUser();

  const parsed = draftRequestSchema.safeParse({
    clientId: formData.get('clientId') ?? '',
    startingPrice: formData.get('startingPrice') ?? '',
    turnaroundDays: formData.get('turnaroundDays') ?? '',
    travelPolicy: formData.get('travelPolicy') ?? '',
    requestedDate: formData.get('requestedDate') ?? '',
  });

  if (!parsed.success) {
    return { draft: null, usedFacts: null, error: firstIssue(parsed.error) };
  }

  const { clientId, ...facts } = parsed.data;

  try {
    const { draft, usedFacts } = await draftClientReply(supabase, clientId, facts);
    return { draft, usedFacts, error: null };
  } catch (cause) {
    return {
      draft: null,
      usedFacts: null,
      error:
        cause instanceof DraftError
          ? cause.message
          : 'Drafting failed. Please try again.',
    };
  }
}

// --- sending ------------------------------------------------------------

export interface SendState {
  sent: boolean;
  error: string | null;
  /** Offered, not applied, once a reply has gone out. */
  suggestedStage: ClientStage | null;
  token: number;
  /**
   * Successful sends only.
   *
   * The composer uses this as a React `key`, which is what clears it after a
   * send: the subtree remounts and its state resets. `token` would be wrong for
   * that — it changes on failures too, and a failed send must not throw away
   * what the photographer typed.
   */
  sentCount: number;
}

export const INITIAL_SEND: SendState = {
  sent: false,
  error: null,
  suggestedStage: null,
  token: 0,
  sentCount: 0,
};

type MessageChannel = Tables<'messages'>['channel'];

/**
 * Sends a reply as email, from the connected studio mailbox when there is one.
 *
 * Falls back to whatever the integration registry provides, so replies still
 * work while a mailbox is being set up.
 */
async function sendByEmail(
  supabase: Session['supabase'],
  input: {
    client: { name: string; email: string | null };
    subject: string;
    body: string;
    inReplyToExternalId?: string;
  },
): Promise<PublishResult> {
  if (!input.client.email) {
    throw new IntegrationError(
      'This client has no email address. Add one to the record before replying.',
      'mail',
    );
  }

  const { mail } = await resolveMailClient(supabase, createAdminClient());

  return mail.send({
    toEmail: input.client.email,
    toName: input.client.name,
    subject: input.subject,
    body: input.body,
    ...(input.inReplyToExternalId ? { inReplyTo: input.inReplyToExternalId } : {}),
  });
}

/**
 * Sends a reply as a direct message on the platform the client wrote in on.
 *
 * Addressed by the sender's platform-scoped id, never by handle — handles get
 * changed and reused, and a quote sent to whoever holds the handle today is not
 * a recoverable mistake. A handle recorded before ids were captured has none,
 * and that is reported rather than worked around.
 */
async function sendByDirectMessage(
  supabase: Session['supabase'],
  input: { clientId: string; channel: MessageChannel; body: string },
): Promise<PublishResult> {
  const platform = input.channel as SocialPlatform;

  const { data: handle } = await supabase
    .from('client_social_handles')
    .select('handle, external_user_id')
    .eq('client_id', input.clientId)
    .eq('platform', platform)
    .maybeSingle();

  if (!handle) {
    throw new IntegrationError(
      `This client has no ${platform} handle on record, so there is nowhere to send the reply.`,
      platform,
    );
  }

  if (!handle.external_user_id) {
    throw new IntegrationError(
      `The ${platform} sender id for @${handle.handle} was never captured, so a ` +
        'reply cannot be addressed. Collect messages again to record it.',
      platform,
    );
  }

  const admin = createAdminClient();
  const account = await getPublishableAccount(supabase, platform);

  if (!account) {
    throw new IntegrationError(
      `${platform} is not linked, so the reply cannot be sent. Link it on Connections.`,
      platform,
    );
  }

  const accessToken = await readAccessToken(admin, account.id);
  if (!accessToken) {
    throw new IntegrationError(
      `The ${platform} token has expired. Reconnect the account on Connections.`,
      platform,
    );
  }

  return getIntegrations().social.sendMessage({
    platform,
    accessToken,
    toExternalId: handle.external_user_id,
    body: input.body,
  });
}

export async function sendReplyAction(
  previous: SendState,
  formData: FormData,
): Promise<SendState> {
  const { supabase } = await requireUser();
  const token = previous.token + 1;
  const fail = (error: string): SendState => ({
    sent: false,
    error,
    suggestedStage: null,
    token,
    // Unchanged on failure, so the composer keeps its contents.
    sentCount: previous.sentCount,
  });

  const parsed = sendReplySchema.safeParse({
    clientId: formData.get('clientId') ?? '',
    subject: formData.get('subject') ?? '',
    body: formData.get('body') ?? '',
    inReplyToMessageId: formData.get('inReplyToMessageId') ?? '',
    isAiDraft: formData.get('isAiDraft') ?? 'false',
  });

  if (!parsed.success) return fail(firstIssue(parsed.error));

  const { clientId, subject, body, inReplyToMessageId, isAiDraft } = parsed.data;

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, email, stage')
    .eq('id', clientId)
    .maybeSingle();

  if (!client) return fail('That client no longer exists.');

  // Resolve the message being answered before anything leaves the building, so a
  // stale or mismatched id fails cheaply rather than after the reply is sent.
  //
  // The channel comes from the message being answered, not from a setting:
  // somebody who wrote in on Instagram expects the answer on Instagram, and
  // emailing them instead arrives out of nowhere from an address they never
  // contacted.
  let inReplyToExternalId: string | undefined;
  let channel: MessageChannel = 'email';

  if (inReplyToMessageId) {
    const { data: inbound } = await supabase
      .from('messages')
      .select('id, external_id, direction, channel')
      .eq('id', inReplyToMessageId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (!inbound || inbound.direction !== 'inbound') {
      return fail('That message is not part of this conversation.');
    }
    inReplyToExternalId = inbound.external_id ?? undefined;
    channel = inbound.channel;
  } else {
    // A fresh message with nothing to answer: use whatever channel this client
    // last reached us on, falling back to email.
    const { data: latest } = await supabase
      .from('messages')
      .select('channel')
      .eq('client_id', clientId)
      .eq('direction', 'inbound')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) channel = latest.channel;
  }

  let result;
  try {
    result =
      channel === 'email'
        ? await sendByEmail(supabase, { client, subject, body, inReplyToExternalId })
        : await sendByDirectMessage(supabase, { clientId, channel, body });
  } catch (cause) {
    // Nothing is recorded. A `messages` row for mail that never left would be
    // worse than the failure itself — it is the kind of lie you find out about
    // three weeks later when the client says they never heard back.
    if (cause instanceof IntegrationError) {
      return fail(
        `${cause.provider} could not send the reply: ${cause.message}` +
          (cause.retryable ? ' You can try again.' : ''),
      );
    }
    return fail('The reply could not be sent. Nothing has been recorded.');
  }

  const outbound: TablesInsert<'messages'> = {
    client_id: clientId,
    direction: 'outbound',
    channel,
    subject,
    body,
    // Outbound mail is not a task; it is the completed task.
    is_handled: true,
    is_ai_draft: isAiDraft,
    sent_at: result.publishedAt,
    external_id: result.externalId,
  };

  // Upsert on the provider id rather than a bare insert. A real provider returns
  // a fresh id per send, so the update branch never fires; the mock derives ids
  // deterministically from recipient + subject, so this is also what keeps a
  // double-submitted send from becoming two rows in the thread.
  const { error: insertError } = await supabase
    .from('messages')
    .upsert(outbound, { onConflict: 'external_id' });

  if (insertError) {
    return fail(
      'The reply was sent, but recording it failed: ' +
        `${insertError.message}. The thread below may be missing it — check the ` +
        'provider before sending again.',
    );
  }

  if (inReplyToMessageId) {
    const { error: handledError } = await supabase
      .from('messages')
      .update({ is_handled: true })
      .eq('id', inReplyToMessageId)
      .eq('client_id', clientId);

    // The reply is out and recorded; a stuck queue flag is a nuisance, not a
    // lie, and the message can still be ticked off by hand.
    if (handledError) {
      revalidateClient(clientId);
      return {
        sent: true,
        error:
          'Sent, but the inquiry could not be marked handled. Mark it off in the thread.',
        suggestedStage: null,
        token,
        sentCount: previous.sentCount + 1,
      };
    }
  }

  revalidateClient(clientId);

  return {
    sent: true,
    error: null,
    suggestedStage: suggestNextStage(client.stage),
    token,
    sentCount: previous.sentCount + 1,
  };
}
