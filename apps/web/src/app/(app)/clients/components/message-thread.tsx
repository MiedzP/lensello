import { MailPlus, Sparkles } from 'lucide-react';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { MessageRow } from '@/lib/clients/queries';
import { age, fullDateTime } from '@/lib/clients/format';
import { HandledToggle } from './handled-toggle';

/**
 * The conversation, oldest first.
 *
 * Inbound and outbound are told apart structurally, not just by colour: they sit
 * on opposite edges, carry different labels, and only inbound messages have a
 * handled control — an email you sent is not a task.
 */
export function MessageThread({
  clientId,
  clientName,
  thread,
}: {
  clientId: string;
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
            description="Nothing has been exchanged with this client. Sync the inbox to pull in new mail, or write the first message below."
          />
        </div>
      ) : (
        <ol className="space-y-4 px-5 py-5">
          {thread.map((message) => {
            const isInbound = message.direction === 'inbound';
            return (
              <li
                key={message.id}
                className={cn(
                  'flex flex-col',
                  isInbound ? 'items-start' : 'items-end',
                )}
              >
                <div
                  className={cn(
                    'w-full max-w-2xl rounded-lg border px-4 py-3',
                    isInbound
                      ? 'border-subtle bg-surface-raised'
                      : 'border-accent/25 bg-accent-subtle',
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
                    {isInbound && !message.is_handled ? (
                      <Badge tone="accent">Needs a reply</Badge>
                    ) : null}
                  </div>

                  {message.subject ? (
                    <p className="mt-1.5 text-sm font-medium text-foreground">
                      {message.subject}
                    </p>
                  ) : null}

                  {/*
                    whitespace-pre-wrap, never dangerouslySetInnerHTML: message
                    bodies are third-party text (and sometimes model output), so
                    they are rendered as text and React escapes them.
                  */}
                  <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">
                    {message.body}
                  </p>
                </div>

                {isInbound ? (
                  <div className="mt-1">
                    <HandledToggle
                      clientId={clientId}
                      messageId={message.id}
                      isHandled={message.is_handled}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
