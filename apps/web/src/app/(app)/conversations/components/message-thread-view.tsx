import { MailPlus, Sparkles } from 'lucide-react';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import { age, fullDateTime } from '@/lib/clients/format';
import type { MessageRow } from '@/lib/conversations/queries';

/**
 * The conversation, oldest first — same layout `MessageThread` uses in the
 * Clients module, kept module-private here since a channel badge and the lack
 * of a per-message handled toggle (triage now lives on the conversation, not
 * the message) make it a different component, not a shared one.
 */
export function MessageThreadView({
  clientName,
  thread,
}: {
  clientName: string;
  thread: MessageRow[];
}) {
  return (
    <Card>
      <CardHeader
        title="Conversation"
        description={
          thread.length > 0
            ? `${thread.length} ${thread.length === 1 ? 'message' : 'messages'}, oldest first.`
            : undefined
        }
      />

      {thread.length === 0 ? (
        <div className="px-5 py-5">
          <EmptyState
            icon={<MailPlus size={24} aria-hidden="true" />}
            title="No messages yet"
            description="Nothing has been exchanged on this thread yet."
          />
        </div>
      ) : (
        <ol className="space-y-4 px-5 py-5">
          {thread.map((message) => {
            const isInbound = message.direction === 'inbound';
            return (
              <li
                key={message.id}
                className={cn('flex flex-col', isInbound ? 'items-start' : 'items-end')}
              >
                <div
                  className={cn(
                    'w-full max-w-2xl rounded-lg border px-4 py-3',
                    isInbound ? 'border-subtle bg-surface-raised' : 'border-accent/25 bg-accent-subtle',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {isInbound ? clientName : 'Lensello'}
                    </span>
                    <span className="text-xs text-faint" title={fullDateTime(message.sent_at)}>
                      {age(message.sent_at)}
                    </span>
                    {message.is_ai_draft ? (
                      <Badge tone="warning">
                        <Sparkles size={11} className="mr-1" aria-hidden="true" />
                        AI draft
                      </Badge>
                    ) : null}
                  </div>

                  {message.subject ? (
                    <p className="mt-1.5 text-sm font-medium text-foreground">{message.subject}</p>
                  ) : null}

                  {/* whitespace-pre-wrap, never dangerouslySetInnerHTML — third-party
                      text (and sometimes model output) is rendered as text. */}
                  <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">{message.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
