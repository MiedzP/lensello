'use server';

/**
 * Every mutation for the Conversations module.
 *
 * Same two rules as `lib/clients/actions.ts`:
 *
 *  1. Every action starts with `await requireUser()`. Actions are reachable by
 *     direct POST; a hidden button proves nothing about who is calling.
 *  2. Everything from the browser is parsed before use.
 *
 * `revalidatePath` rather than `updateTag`, for the same reason as the Clients
 * module: `updateTag` needs `cacheComponents: true`, which is not enabled, and
 * is not this module's file to enable.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  IntegrationError,
  getIntegrations,
  type PublishResult,
} from '@lensello/core/integrations';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@lensello/core';
import type { Session } from '@/lib/auth';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveMailClient } from '@/lib/mailboxes/queries';
import {
  getPublishableAccount,
  readAccessToken,
} from '@/lib/connections/queries';
import { DraftError, draftClientReply, type UsedFacts } from '@/lib/clients/draft';
import { draftRequestSchema, type ReplyDraft } from '@/lib/clients/schemas';
import type { TablesInsert } from '@/lib/db.types';
import { isSendableChannel, unsendableChannelReason } from '@/lib/conversations/channels';
import { normalizeContactIdentifier } from '@/lib/conversations/identity';
import { markConversationRead, searchClients } from '@/lib/conversations/queries';
import {
  addIdentitySchema,
  assignSchema,
  firstIssue,
  identityIdSchema,
  mergeSchema,
  searchClientsSchema,
  sendReplySchema,
  setStageSchema,
  setStatusSchema,
} from '@/lib/conversations/schemas';
import type { ReplyState, SimpleState } from './form-state';

function revalidateInbox(): void {
  revalidatePath('/conversations');
}

function describeFailure(cause: unknown, fallback: string): string {
  if (cause instanceof IntegrationError) {
    return `${cause.provider}: ${cause.message}${cause.retryable ? ' You can try again.' : ''}`;
  }
  return cause instanceof Error ? cause.message : fallback;
}

// --- reading a thread -----------------------------------------------------

/**
 * Zeroes a thread's unread badge.
 *
 * Called from a Client Component's `useEffect` once the thread has actually
 * mounted on screen — not from the Server Component that loads the page,
 * because Next may render that speculatively (link prefetching) before the
 * studio has looked at anything, and a mutation must not ride along with a
 * read that might not represent a real view.
 */
export async function markThreadReadAction(conversationId: string): Promise<void> {
  const { supabase } = await requireUser();
  if (!z.uuid().safeParse(conversationId).success) return;

  await markConversationRead(supabase, conversationId);
  revalidateInbox();
}

// --- triage ----------------------------------------------------------------

export async function setConversationStatusAction(
  previous: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const { supabase } = await requireUser();
  const token = previous.token + 1;

  const parsed = setStatusSchema.safeParse({
    conversationId: formData.get('conversationId') ?? '',
    status: formData.get('status') ?? '',
    snoozedUntil: formData.get('snoozedUntil') ?? '',
  });

  if (!parsed.success) return { error: firstIssue(parsed.error), message: null, token };
  const { conversationId, status, snoozedUntil } = parsed.data;

  if (status === 'snoozed' && !snoozedUntil) {
    return { error: 'Pick a date to snooze until.', message: null, token };
  }

  const { error } = await supabase
    .from('conversations')
    .update({
      status,
      snoozed_until: status === 'snoozed' ? snoozedUntil : null,
    })
    .eq('id', conversationId);

  if (error) {
    return { error: `Could not change the status: ${error.message}`, message: null, token };
  }

  revalidateInbox();
  return { error: null, message: null, token };
}

export async function assignConversationAction(
  previous: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const { supabase } = await requireUser();
  const token = previous.token + 1;

  const parsed = assignSchema.safeParse({
    conversationId: formData.get('conversationId') ?? '',
    assigneeId: formData.get('assigneeId') ?? '',
  });

  if (!parsed.success) return { error: firstIssue(parsed.error), message: null, token };

  const { error } = await supabase
    .from('conversations')
    .update({ assigned_to: parsed.data.assigneeId })
    .eq('id', parsed.data.conversationId);

  if (error) {
    return { error: `Could not reassign the thread: ${error.message}`, message: null, token };
  }

  revalidateInbox();
  return { error: null, message: null, token };
}

// --- AI drafting ------------------------------------------------------------

export interface DraftResult {
  draft: ReplyDraft | null;
  usedFacts: UsedFacts | null;
  error: string | null;
}

/**
 * Reuses the Clients module's drafting exactly as it stands — same prompt,
 * same "never invent a fact" contract, same nothing-written-until-send
 * guarantee. Nothing here is conversations-specific; it exists only so the
 * composer in this module can call it without importing across module
 * boundaries from a Client Component.
 */
export async function draftConversationReplyAction(formData: FormData): Promise<DraftResult> {
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
      error: cause instanceof DraftError ? cause.message : 'Drafting failed. Please try again.',
    };
  }
}

// --- sending ----------------------------------------------------------------

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
      'This client has no email address on record. Add one before replying by email.',
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
 * Same rule as `lib/clients/actions.ts`: addressed by the sender's
 * platform-scoped id, never by handle. A handle is a display name that gets
 * changed and reused; a reply addressed to whoever holds it today is not a
 * recoverable mistake.
 */
async function sendByDirectMessage(
  supabase: Session['supabase'],
  input: { clientId: string; platform: SocialPlatform; body: string },
): Promise<PublishResult> {
  const { platform } = input;

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
      `The ${platform} sender id for @${handle.handle} was never captured, so a reply ` +
        'cannot be addressed. Collect messages again on Connections to record it.',
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

export async function sendConversationReplyAction(
  previous: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const { supabase } = await requireUser();
  const token = previous.token + 1;
  const fail = (error: string): ReplyState => ({
    sent: false,
    error,
    token,
    sentCount: previous.sentCount,
  });

  const parsed = sendReplySchema.safeParse({
    conversationId: formData.get('conversationId') ?? '',
    subject: formData.get('subject') ?? '',
    body: formData.get('body') ?? '',
    isAiDraft: formData.get('isAiDraft') ?? 'false',
  });

  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { conversationId, subject, body, isAiDraft } = parsed.data;

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, client_id, channel, subject')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation) return fail('That conversation no longer exists.');

  const channel = conversation.channel;
  if (!isSendableChannel(channel)) {
    return fail(unsendableChannelReason(channel) ?? 'This channel cannot send a reply.');
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, email')
    .eq('id', conversation.client_id)
    .maybeSingle();

  if (!client) return fail('That client no longer exists.');

  let result: PublishResult;
  try {
    if (channel === 'email') {
      const { data: lastInbound } = await supabase
        .from('messages')
        .select('external_id')
        .eq('conversation_id', conversationId)
        .eq('direction', 'inbound')
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const effectiveSubject =
        subject ??
        (conversation.subject
          ? `Re: ${conversation.subject.replace(/^\s*(re:\s*)+/i, '')}`
          : 'Re: your message');

      result = await sendByEmail(supabase, {
        client,
        subject: effectiveSubject,
        body,
        inReplyToExternalId: lastInbound?.external_id ?? undefined,
      });
    } else {
      result = await sendByDirectMessage(supabase, {
        clientId: client.id,
        platform: channel,
        body,
      });
    }
  } catch (cause) {
    return fail(describeFailure(cause, 'The reply could not be sent. Nothing has been recorded.'));
  }

  const outbound: TablesInsert<'messages'> = {
    client_id: client.id,
    direction: 'outbound',
    channel,
    subject: channel === 'email' ? subject ?? conversation.subject ?? null : null,
    body,
    is_handled: true,
    is_ai_draft: isAiDraft,
    sent_at: result.publishedAt,
    external_id: result.externalId,
    // Explicit: the trigger only assigns a conversation when one is missing,
    // and a reply typed in this thread belongs on it, not on whichever thread
    // happens to be most recent for this client + channel.
    conversation_id: conversationId,
  };

  const { error: insertError } = await supabase
    .from('messages')
    .upsert(outbound, { onConflict: 'external_id' });

  if (insertError) {
    return fail(
      'The reply was sent, but recording it failed: ' +
        `${insertError.message}. Check the provider before sending again.`,
    );
  }

  revalidateInbox();
  return { sent: true, error: null, token, sentCount: previous.sentCount + 1 };
}

// --- the CRM panel -----------------------------------------------------------

export async function setClientStageAction(
  previous: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const { supabase } = await requireUser();
  const token = previous.token + 1;

  const parsed = setStageSchema.safeParse({
    clientId: formData.get('clientId') ?? '',
    stage: formData.get('stage') ?? '',
  });

  if (!parsed.success) return { error: firstIssue(parsed.error), message: null, token };

  const { error } = await supabase
    .from('clients')
    .update({ stage: parsed.data.stage })
    .eq('id', parsed.data.clientId);

  if (error) return { error: `Could not change the stage: ${error.message}`, message: null, token };

  revalidateInbox();
  return { error: null, message: null, token };
}

export async function addContactIdentityAction(
  previous: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const { supabase } = await requireUser();
  const token = previous.token + 1;

  const parsed = addIdentitySchema.safeParse({
    clientId: formData.get('clientId') ?? '',
    channel: formData.get('channel') ?? '',
    identifier: formData.get('identifier') ?? '',
    displayName: formData.get('displayName') ?? '',
  });

  if (!parsed.success) return { error: firstIssue(parsed.error), message: null, token };
  const { clientId, channel, identifier, displayName } = parsed.data;

  const normalized = normalizeContactIdentifier(channel, identifier);
  if (!normalized) {
    return {
      error: `That does not look like a valid ${channel} identifier.`,
      message: null,
      token,
    };
  }

  const { data: existing } = await supabase
    .from('contact_identities')
    .select('id, client_id')
    .eq('channel', channel)
    .eq('identifier', normalized)
    .maybeSingle();

  if (existing) {
    if (existing.client_id === clientId) {
      return { error: null, message: 'That identity is already on this client.', token };
    }
    const { data: otherClient } = await supabase
      .from('clients')
      .select('name')
      .eq('id', existing.client_id)
      .maybeSingle();
    return {
      error: `That ${channel} identity already belongs to ${otherClient?.name ?? 'another client'}. Merge the threads instead of adding it here.`,
      message: null,
      token,
    };
  }

  const { error } = await supabase.from('contact_identities').insert({
    client_id: clientId,
    channel,
    identifier: normalized,
    display_name: displayName,
    verified: false,
    is_primary: false,
  });

  if (error) return { error: `Could not save that: ${error.message}`, message: null, token };

  revalidateInbox();
  return { error: null, message: 'Contact identity added. Verify it once you have seen them use it.', token };
}

export async function verifyContactIdentityAction(
  previous: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const { supabase } = await requireUser();
  const token = previous.token + 1;

  const parsed = identityIdSchema.safeParse({
    clientId: formData.get('clientId') ?? '',
    identityId: formData.get('identityId') ?? '',
  });
  if (!parsed.success) return { error: firstIssue(parsed.error), message: null, token };

  const { error } = await supabase
    .from('contact_identities')
    .update({ verified: true })
    .eq('id', parsed.data.identityId)
    .eq('client_id', parsed.data.clientId);

  if (error) return { error: `Could not verify that: ${error.message}`, message: null, token };

  revalidateInbox();
  return { error: null, message: 'Marked verified.', token };
}

export async function removeContactIdentityAction(
  previous: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const { supabase } = await requireUser();
  const token = previous.token + 1;

  const parsed = identityIdSchema.safeParse({
    clientId: formData.get('clientId') ?? '',
    identityId: formData.get('identityId') ?? '',
  });
  if (!parsed.success) return { error: firstIssue(parsed.error), message: null, token };

  const { error } = await supabase
    .from('contact_identities')
    .delete()
    .eq('id', parsed.data.identityId)
    .eq('client_id', parsed.data.clientId);

  if (error) return { error: `Could not remove that: ${error.message}`, message: null, token };

  revalidateInbox();
  return { error: null, message: 'Removed.', token };
}

/**
 * Moves a thread — and everything filed under it — onto a different client
 * record.
 *
 * The scenario this exists for: an inbound DM arrived from a handle
 * `syncSocialMessages` (Connections module) had never seen, so it created a
 * fresh client for it. Staff recognises the person and wants their history on
 * the client record that already exists, not scattered across a duplicate.
 */
export async function mergeConversationAction(
  previous: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const { supabase } = await requireUser();
  const token = previous.token + 1;

  const parsed = mergeSchema.safeParse({
    conversationId: formData.get('conversationId') ?? '',
    targetClientId: formData.get('targetClientId') ?? '',
  });
  if (!parsed.success) return { error: firstIssue(parsed.error), message: null, token };
  const { conversationId, targetClientId } = parsed.data;

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, client_id, channel')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation) return { error: 'That conversation no longer exists.', message: null, token };
  if (conversation.client_id === targetClientId) {
    return { error: 'That thread is already on this client.', message: null, token };
  }

  const { data: target } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', targetClientId)
    .maybeSingle();

  if (!target) return { error: 'That client no longer exists.', message: null, token };

  const { error: messagesError } = await supabase
    .from('messages')
    .update({ client_id: targetClientId })
    .eq('conversation_id', conversationId);

  if (messagesError) {
    return { error: `Could not move the messages: ${messagesError.message}`, message: null, token };
  }

  const { error: conversationError } = await supabase
    .from('conversations')
    .update({ client_id: targetClientId })
    .eq('id', conversationId);

  if (conversationError) {
    return {
      error: `The messages moved, but the thread record did not: ${conversationError.message}`,
      message: null,
      token,
    };
  }

  if ((SOCIAL_PLATFORMS as readonly string[]).includes(conversation.channel)) {
    const platform = conversation.channel as SocialPlatform;
    const { data: oldHandle } = await supabase
      .from('client_social_handles')
      .select('id, handle')
      .eq('client_id', conversation.client_id)
      .eq('platform', platform)
      .maybeSingle();

    if (oldHandle) {
      await supabase
        .from('client_social_handles')
        .update({ client_id: targetClientId })
        .eq('id', oldHandle.id);

      // So the next arrival on this handle resolves here too, without staff
      // having to do this merge again.
      await supabase.from('contact_identities').upsert(
        {
          client_id: targetClientId,
          channel: platform,
          identifier: oldHandle.handle,
          verified: true,
        },
        { onConflict: 'channel,identifier' },
      );
    }
  }

  revalidateInbox();
  return { error: null, message: `Moved to ${target.name}.`, token };
}

export async function searchClientsAction(
  query: string,
): Promise<{ id: string; name: string; email: string | null }[]> {
  const { supabase } = await requireUser();

  const parsed = searchClientsSchema.safeParse({ query });
  if (!parsed.success) return [];

  return searchClients(supabase, parsed.data.query);
}
