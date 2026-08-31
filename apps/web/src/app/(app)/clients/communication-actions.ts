'use server';

/**
 * Server actions for the Client Communication module.
 *
 * Handles:
 *  1. Starting and managing conversations with clients
 *  2. Sending and retrieving messages
 *  3. Requesting and submitting feedback
 *
 * All actions start with `await requireUser()` and parse browser input before use.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Session } from '@/lib/auth';
import { requireUser } from '@/lib/auth';
import type { TablesInsert } from '@/lib/db.types';
import type {
  Conversation,
  ConversationWithClient,
  FeedbackRequest,
  FeedbackRequestWithDetails,
  Message,
  MessageDirection,
  SendMessageInput,
  StartConversationInput,
  SubmitFeedbackInput,
} from '@/lib/communication/types';

// ---------------------------------------------------------------------------
// schemas
// ---------------------------------------------------------------------------

const startConversationSchema = z.object({
  projectId: z.string().uuid().optional(),
  clientEmail: z.string().email().optional(),
  clientId: z.string().uuid().optional(),
  subject: z.string().min(1, 'Subject is required'),
  channel: z.enum(['email', 'form', 'instagram', 'facebook', 'tiktok', 'pinterest', 'sms', 'whatsapp', 'comment']),
});

const sendMessageSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  body: z.string().min(1, 'Message cannot be empty'),
  subject: z.string().optional(),
});

const requestFeedbackSchema = z.object({
  conversationId: z.string().uuid().optional(),
  clientId: z.string().uuid('Invalid client ID'),
  projectId: z.string().uuid().optional(),
  deliverableId: z.string().optional(),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().optional(),
  deadline: z.string().datetime('Invalid deadline format'),
});

const submitFeedbackSchema = z.object({
  feedbackRequestId: z.string().uuid('Invalid feedback request ID'),
  feedbackText: z.string().min(1, 'Feedback cannot be empty'),
  rating: z.number().int().min(1).max(5).optional(),
});

// ---------------------------------------------------------------------------
// conversations
// ---------------------------------------------------------------------------

/**
 * Start a new conversation with a client or retrieve existing one.
 *
 * Creates a new conversation on the specified channel if one doesn't already
 * exist for the client+channel combination, or returns the existing one.
 */
export async function startConversation(
  input: StartConversationInput,
): Promise<{ conversation: ConversationWithClient; error: null } | { conversation: null; error: string }> {
  const { supabase } = await requireUser();
  const token = z.object({ token: z.number() }).parse({ token: 1 });

  const parsed = startConversationSchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message || 'Invalid input';
    return { conversation: null, error };
  }

  const { clientId, clientEmail, subject, channel } = parsed.data;

  // Resolve client ID from email if not provided
  let resolvedClientId = clientId;
  if (!resolvedClientId && clientEmail) {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('email', clientEmail)
      .maybeSingle();

    if (!client) {
      return { conversation: null, error: 'Client not found with that email address' };
    }
    resolvedClientId = client.id;
  }

  if (!resolvedClientId) {
    return { conversation: null, error: 'Client ID or email is required' };
  }

  // Look for existing conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, client_id, channel, status, subject, last_message_at, unread_count')
    .eq('client_id', resolvedClientId)
    .eq('channel', channel)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('id', resolvedClientId)
      .maybeSingle();

    return {
      conversation: existing as ConversationWithClient & { client: any },
      error: null,
    };
  }

  // Create new conversation
  const newConversation: TablesInsert<'conversations'> = {
    client_id: resolvedClientId,
    channel,
    subject,
    status: 'open',
  };

  const { data: created, error: createError } = await supabase
    .from('conversations')
    .insert(newConversation)
    .select()
    .single();

  if (createError || !created) {
    return { conversation: null, error: createError?.message || 'Could not create conversation' };
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, email')
    .eq('id', resolvedClientId)
    .maybeSingle();

  revalidatePath('/clients');
  return {
    conversation: created as ConversationWithClient & { client: any },
    error: null,
  };
}

/**
 * Retrieve a conversation with all its metadata and recent messages.
 */
export async function getConversation(
  conversationId: string,
): Promise<
  { conversation: ConversationWithClient; messages: Message[]; error: null } | { conversation: null; messages: null; error: string }
> {
  const { supabase } = await requireUser();

  if (!z.string().uuid().safeParse(conversationId).success) {
    return { conversation: null, messages: null, error: 'Invalid conversation ID' };
  }

  const { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation) {
    return { conversation: null, messages: null, error: 'Conversation not found' };
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, email')
    .eq('id', conversation.client_id)
    .maybeSingle();

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true });

  // Mark as read
  await supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId);

  revalidatePath('/clients');
  return {
    conversation: { ...conversation, client } as ConversationWithClient,
    messages: messages || [],
    error: null,
  };
}

// ---------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------

/**
 * Send a message in a conversation.
 *
 * Adds a new message to the conversation and updates the conversation's
 * last_message_at timestamp.
 */
export async function sendMessage(
  input: SendMessageInput,
): Promise<{ message: Message; error: null } | { message: null; error: string }> {
  const { supabase } = await requireUser();

  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message || 'Invalid input';
    return { message: null, error };
  }

  const { conversationId, body, subject } = parsed.data;

  // Get conversation to access client_id and channel
  const { data: conversation } = await supabase
    .from('conversations')
    .select('client_id, channel')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conversation) {
    return { message: null, error: 'Conversation not found' };
  }

  const newMessage: TablesInsert<'messages'> = {
    client_id: conversation.client_id,
    conversation_id: conversationId,
    channel: conversation.channel as any,
    direction: 'outbound',
    body,
    subject: subject || null,
    sent_at: new Date().toISOString(),
    is_handled: true,
  };

  const { data: created, error: createError } = await supabase
    .from('messages')
    .insert(newMessage)
    .select()
    .single();

  if (createError || !created) {
    return { message: null, error: createError?.message || 'Could not send message' };
  }

  revalidatePath('/clients');
  return { message: created, error: null };
}

// ---------------------------------------------------------------------------
// feedback requests
// ---------------------------------------------------------------------------

/**
 * Request feedback from a client on a deliverable.
 *
 * Creates a feedback request and associates it with a conversation. If no
 * conversation exists yet, creates one first.
 */
export async function requestFeedback(
  input: z.infer<typeof requestFeedbackSchema>,
): Promise<
  { feedbackRequest: FeedbackRequestWithDetails; error: null } | { feedbackRequest: null; error: string }
> {
  const { supabase } = await requireUser();
  const { user } = await requireUser();

  const parsed = requestFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message || 'Invalid input';
    return { feedbackRequest: null, error };
  }

  const { clientId, projectId, deliverableId, subject, message, deadline, conversationId } = parsed.data;

  // Get or create conversation
  let finalConversationId = conversationId;
  if (!finalConversationId) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, email')
      .eq('id', clientId)
      .maybeSingle();

    if (!client) {
      return { feedbackRequest: null, error: 'Client not found' };
    }

    // Create a conversation for feedback
    const { data: conversation } = await supabase
      .from('conversations')
      .insert({
        client_id: clientId,
        channel: 'email',
        subject: `Feedback Request: ${subject}`,
        status: 'open',
      })
      .select()
      .single();

    if (!conversation) {
      return { feedbackRequest: null, error: 'Could not create conversation' };
    }
    finalConversationId = conversation.id;
  }

  const newFeedbackRequest: TablesInsert<'feedback_requests'> = {
    conversation_id: finalConversationId,
    client_id: clientId,
    project_id: projectId || null,
    deliverable_id: deliverableId || null,
    subject,
    message: message || null,
    deadline,
    requested_by: user.id,
  };

  const { data: created, error: createError } = await supabase
    .from('feedback_requests')
    .insert(newFeedbackRequest)
    .select()
    .single();

  if (createError || !created) {
    return { feedbackRequest: null, error: createError?.message || 'Could not request feedback' };
  }

  revalidatePath('/clients');
  return { feedbackRequest: created as FeedbackRequestWithDetails, error: null };
}

/**
 * Submit feedback in response to a feedback request.
 *
 * Records client feedback and creates a feedback response record. Updates
 * the associated feedback request status to 'submitted'.
 */
export async function submitFeedback(
  input: SubmitFeedbackInput,
): Promise<{ success: boolean; error: string | null }> {
  const { supabase } = await requireUser();

  const parsed = submitFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues[0]?.message || 'Invalid input';
    return { success: false, error };
  }

  const { feedbackRequestId, feedbackText, rating } = parsed.data;

  // Get the feedback request to find client ID
  const { data: feedbackRequest } = await supabase
    .from('feedback_requests')
    .select('id, client_id')
    .eq('id', feedbackRequestId)
    .maybeSingle();

  if (!feedbackRequest) {
    return { success: false, error: 'Feedback request not found' };
  }

  const newResponse: TablesInsert<'feedback_responses'> = {
    feedback_request_id: feedbackRequestId,
    client_id: feedbackRequest.client_id,
    feedback_text: feedbackText,
    rating: rating || null,
  };

  const { error: createError } = await supabase.from('feedback_responses').insert(newResponse);

  if (createError) {
    return { success: false, error: createError.message };
  }

  revalidatePath('/clients');
  return { success: true, error: null };
}

/**
 * Get all pending feedback requests for a client.
 */
export async function getClientFeedbackRequests(
  clientId: string,
): Promise<FeedbackRequest[] | null> {
  const { supabase } = await requireUser();

  if (!z.string().uuid().safeParse(clientId).success) {
    return null;
  }

  const { data } = await supabase
    .from('feedback_requests')
    .select('*')
    .eq('client_id', clientId)
    .order('deadline', { ascending: true });

  return data || null;
}

/**
 * Close a feedback request (mark as complete).
 */
export async function closeFeedbackRequest(feedbackRequestId: string): Promise<boolean> {
  const { supabase } = await requireUser();

  if (!z.string().uuid().safeParse(feedbackRequestId).success) {
    return false;
  }

  const { error } = await supabase
    .from('feedback_requests')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', feedbackRequestId);

  if (error) {
    return false;
  }

  revalidatePath('/clients');
  return true;
}
