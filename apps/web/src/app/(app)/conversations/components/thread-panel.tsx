import { ErrorNote } from '@/components/ui';
import { isAiConfigured } from '@/lib/ai';
import { findRequestedDate } from '@/lib/clients/requested-date';
import { unsendableChannelReason } from '@/lib/conversations/channels';
import type { ConversationDetail, ProfileRow } from '@/lib/conversations/queries';
import { CrmPanel } from './crm-panel';
import { MarkThreadRead } from './mark-thread-read';
import { MessageThreadView } from './message-thread-view';
import { ReplyPanel } from './reply-panel';
import { TriageControls } from './triage-controls';

/** The open thread, its composer, and the CRM panel beside it. */
export function ThreadPanel({
  detail,
  staff,
}: {
  detail: ConversationDetail;
  staff: ProfileRow[];
}) {
  const { conversation, client, thread } = detail;

  const inboundText = thread
    .filter((message) => message.direction === 'inbound')
    .map((message) => `${message.subject ?? ''}\n${message.body}`)
    .join('\n\n');
  const suggestedDate = findRequestedDate(inboundText);

  const defaultSubject = conversation.subject
    ? `Re: ${conversation.subject.replace(/^\s*(re:\s*)+/i, '')}`
    : '';

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <MarkThreadRead conversationId={conversation.id} />

        <TriageControls
          conversationId={conversation.id}
          status={conversation.status}
          assignedTo={conversation.assigned_to}
          staff={staff}
        />

        {conversation.status === 'snoozed' && conversation.snoozed_until ? (
          <ErrorNote>
            Snoozed until {new Date(conversation.snoozed_until).toLocaleDateString()}.
          </ErrorNote>
        ) : null}

        <MessageThreadView clientName={client.name} thread={thread} />

        <ReplyPanel
          conversationId={conversation.id}
          clientId={client.id}
          channel={conversation.channel}
          unsendableReason={unsendableChannelReason(conversation.channel)}
          defaultSubject={defaultSubject}
          suggestedDate={suggestedDate}
          aiEnabled={isAiConfigured()}
        />
      </div>

      <CrmPanel detail={detail} />
    </div>
  );
}
