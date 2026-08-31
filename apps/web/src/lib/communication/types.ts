/**
 * Shared shapes for the Client Communication module.
 *
 * Types for conversations, messages, and feedback requests that bridge
 * between database schema and application logic.
 */

import type { Tables, TablesInsert, TablesUpdate } from '@/lib/db.types';

// ---------------------------------------------------------------------------
// conversations
// ---------------------------------------------------------------------------

export type Conversation = Tables<'conversations'>;

export type ConversationInsert = TablesInsert<'conversations'>;

export type ConversationUpdate = TablesUpdate<'conversations'>;

export type ConversationChannel =
  | 'email'
  | 'form'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'pinterest'
  | 'sms'
  | 'whatsapp'
  | 'comment';

export type ConversationStatus = 'open' | 'snoozed' | 'closed';

export interface ConversationWithClient extends Conversation {
  client: {
    id: string;
    name: string;
    email: string | null;
  };
  assigned_staff?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

// ---------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------

export type Message = Tables<'messages'>;

export type MessageInsert = TablesInsert<'messages'>;

export type MessageUpdate = TablesUpdate<'messages'>;

export type MessageDirection = 'inbound' | 'outbound';

export interface MessageWithMetadata extends Message {
  senderName?: string;
  senderEmail?: string;
}

export interface MessageGroup {
  conversationId: string;
  channel: ConversationChannel;
  messages: Message[];
}

// ---------------------------------------------------------------------------
// feedback requests
// ---------------------------------------------------------------------------

export type FeedbackRequest = Tables<'feedback_requests'>;

export type FeedbackRequestInsert = TablesInsert<'feedback_requests'>;

export type FeedbackRequestUpdate = TablesUpdate<'feedback_requests'>;

export type FeedbackStatus = 'pending' | 'submitted' | 'closed';

export interface FeedbackRequestWithDetails extends FeedbackRequest {
  conversation?: Conversation;
  client?: {
    id: string;
    name: string;
    email: string | null;
  };
  requested_by_staff?: {
    id: string;
    name: string | null;
    email: string;
  };
  response?: FeedbackResponse | null;
}

// ---------------------------------------------------------------------------
// feedback responses
// ---------------------------------------------------------------------------

export type FeedbackResponse = Tables<'feedback_responses'>;

export type FeedbackResponseInsert = TablesInsert<'feedback_responses'>;

export type FeedbackResponseUpdate = TablesUpdate<'feedback_responses'>;

// ---------------------------------------------------------------------------
// form inputs
// ---------------------------------------------------------------------------

export interface StartConversationInput {
  projectId?: string;
  clientEmail?: string;
  clientId?: string;
  subject: string;
  channel: ConversationChannel;
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
  senderType: 'staff' | 'client';
  subject?: string;
}

export interface RequestFeedbackInput {
  conversationId?: string;
  clientId: string;
  projectId?: string;
  deliverableId?: string;
  subject: string;
  message?: string;
  deadline: string; // ISO date string
}

export interface SubmitFeedbackInput {
  feedbackRequestId: string;
  feedbackText: string;
  rating?: number;
}

// ---------------------------------------------------------------------------
// response shapes
// ---------------------------------------------------------------------------

export interface ConversationResponse {
  id: string;
  clientName: string;
  clientEmail: string | null;
  channel: ConversationChannel;
  status: ConversationStatus;
  subject: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  unreadCount: number;
}

export interface MessageListResponse {
  conversationId: string;
  messages: Array<{
    id: string;
    direction: MessageDirection;
    body: string;
    sentAt: string;
    senderName?: string;
    channel: ConversationChannel;
  }>;
}

export interface FeedbackRequestResponse {
  id: string;
  clientName: string;
  subject: string;
  deadline: string;
  status: FeedbackStatus;
  daysUntilDeadline: number;
  hasResponse: boolean;
}
