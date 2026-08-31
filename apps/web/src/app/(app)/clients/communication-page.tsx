'use client';

/**
 * Client Communication page component.
 *
 * Displays:
 *  1. List of client conversations
 *  2. Message thread interface
 *  3. Feedback request management
 *  4. Quick actions for starting conversations or requesting feedback
 */

import { useState, useCallback, useEffect } from 'react';
import { formatDistanceToNow, isPast } from 'date-fns';
import type { Conversation, Message, FeedbackRequest, ConversationChannel } from '@/lib/communication/types';
import {
  startConversation,
  getConversation,
  sendMessage,
  requestFeedback,
  getClientFeedbackRequests,
} from './communication-actions';

// ---------------------------------------------------------------------------
// conversation list
// ---------------------------------------------------------------------------

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 p-8 text-center">
        <p className="text-sm font-medium text-gray-700">No conversations yet</p>
        <p className="text-xs text-gray-500">Start a conversation or wait for inbound messages</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={`w-full rounded-lg border p-3 text-left transition-colors ${
            selectedId === conv.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="mb-1 flex items-start justify-between">
            <h3 className="font-medium text-gray-900">{conv.subject || `${conv.channel} conversation`}</h3>
            {conv.unread_count > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-500 px-2 py-1 text-xs font-medium text-white">
                {conv.unread_count}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {conv.channel.toUpperCase()} • {conv.last_message_at ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true }) : 'No messages'}
          </p>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// message thread
// ---------------------------------------------------------------------------

interface MessageThreadProps {
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  onSendMessage: (body: string) => Promise<void>;
}

function MessageThread({ conversation, messages, loading, onSendMessage }: MessageThreadProps) {
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!messageBody.trim() || !conversation) return;

    setSending(true);
    try {
      await onSendMessage(messageBody);
      setMessageBody('');
    } finally {
      setSending(false);
    }
  };

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 p-8 text-center">
        <p className="text-sm font-medium text-gray-700">Select a conversation</p>
        <p className="text-xs text-gray-500">Choose a conversation from the list to view messages</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between rounded-lg border border-gray-200 p-4">
        <div>
          <h2 className="font-medium text-gray-900">{conversation.subject || 'Conversation'}</h2>
          <p className="text-xs text-gray-500">
            {conversation.channel.toUpperCase()} • Status: {conversation.status.toUpperCase()}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 p-8">
          <p className="text-sm text-gray-500">Loading messages...</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-gray-200 p-8">
          <p className="text-sm text-gray-500">No messages yet</p>
        </div>
      ) : (
        <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-gray-200 p-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg p-3 ${
                msg.direction === 'outbound'
                  ? 'bg-blue-50 text-right'
                  : 'bg-gray-50'
              }`}
            >
              <p className="text-sm text-gray-900">{msg.body}</p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDistanceToNow(new Date(msg.sent_at), { addSuffix: true })}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type your message..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={sending || !messageBody.trim()}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// feedback requests list
// ---------------------------------------------------------------------------

interface FeedbackRequestsListProps {
  requests: FeedbackRequest[];
}

function FeedbackRequestsList({ requests }: FeedbackRequestsListProps) {
  if (requests.length === 0) {
    return <p className="text-xs text-gray-500">No feedback requests</p>;
  }

  return (
    <div className="space-y-2">
      {requests.map((req) => {
        const isOverdue = req.deadline && isPast(new Date(req.deadline)) && req.status === 'pending';
        return (
          <div
            key={req.id}
            className={`rounded-lg border p-3 ${
              isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <h4 className="font-medium text-gray-900">{req.subject}</h4>
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${
                  req.status === 'submitted'
                    ? 'bg-green-100 text-green-700'
                    : isOverdue
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {req.status === 'submitted' ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-600">{req.message}</p>
            <p className="mt-2 text-xs text-gray-500">
              Due: {new Date(req.deadline).toLocaleDateString()}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// main component
// ---------------------------------------------------------------------------

interface ClientCommunicationPageProps {
  clientId: string;
  conversations: Conversation[];
}

export function ClientCommunicationPage({ clientId, conversations: initialConversations }: ClientCommunicationPageProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [feedbackRequests, setFeedbackRequests] = useState<FeedbackRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Load conversation details when selected
  const loadConversation = useCallback(
    async (conversationId: string) => {
      setLoading(true);
      try {
        const result = await getConversation(conversationId);
        if (result.error) {
          console.error('Error loading conversation:', result.error);
          return;
        }
        setSelectedConversation(result.conversation);
        setMessages(result.messages);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Load feedback requests for client
  const loadFeedbackRequests = useCallback(async () => {
    const requests = await getClientFeedbackRequests(clientId);
    if (requests) {
      setFeedbackRequests(requests);
    }
  }, [clientId]);

  useEffect(() => {
    loadFeedbackRequests();
  }, [loadFeedbackRequests]);

  // Load conversation when selected
  useEffect(() => {
    if (selectedConversationId) {
      loadConversation(selectedConversationId);
    }
  }, [selectedConversationId, loadConversation]);

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (body: string) => {
      if (!selectedConversationId) return;

      const result = await sendMessage({
        conversationId: selectedConversationId,
        body,
      });

      if (!result.error) {
        // Reload messages
        await loadConversation(selectedConversationId);
      }
    },
    [selectedConversationId, loadConversation],
  );

  // Handle starting a new conversation
  const handleStartConversation = useCallback(async (channel: ConversationChannel) => {
    const result = await startConversation({
      clientId,
      channel,
      subject: `New ${channel} conversation`,
    });

    if (!result.error) {
      setConversations((prev) => [...prev, result.conversation as Conversation]);
      setSelectedConversationId(result.conversation.id);
    }
  }, [clientId]);

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
      {/* Conversations sidebar */}
      <div className="space-y-4 lg:col-span-1">
        <div>
          <h2 className="mb-3 font-semibold text-gray-900">Conversations</h2>
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversationId}
            onSelect={setSelectedConversationId}
          />
        </div>

        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          <h3 className="text-sm font-medium text-gray-900">Start New</h3>
          <div className="grid grid-cols-2 gap-2">
            {(['email', 'sms', 'instagram', 'facebook'] as ConversationChannel[]).map((channel) => (
              <button
                key={channel}
                onClick={() => handleStartConversation(channel)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                {channel.charAt(0).toUpperCase() + channel.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-gray-200 p-3">
          <h3 className="text-sm font-medium text-gray-900">Feedback Requests</h3>
          <FeedbackRequestsList requests={feedbackRequests} />
        </div>
      </div>

      {/* Message thread */}
      <div className="lg:col-span-2">
        <MessageThread
          conversation={selectedConversation}
          messages={messages}
          loading={loading}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
}
