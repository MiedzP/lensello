import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import { z } from 'zod';
import { Badge, Card, CardBody, PageHeader } from '@/components/ui';
import { CLIENT_STAGE_LABELS } from '@lensello/core';
import { isAiConfigured } from '@/lib/ai';
import { requireUserOrRedirect } from '@/lib/auth';
import { getClientDetail, gigsOnDate } from '@/lib/clients/queries';
import { formatDateOnly, shortDate } from '@/lib/clients/format';
import { findRequestedDate } from '@/lib/clients/requested-date';
import { CLIENT_SOURCE_LABELS, CLIENT_STAGE_TONES } from '@/lib/clients/stages';
import { ClientRecordForm } from '../components/client-record-form';
import { MessageThread } from '../components/message-thread';
import { ReplyComposer } from '../components/reply-composer';

export const metadata: Metadata = { title: 'Client' };

export default async function ClientDetailPage(
  props: PageProps<'/clients/[clientId]'>,
) {
  const { supabase } = await requireUserOrRedirect();
  // Async in Next 16 — params is a Promise.
  const { clientId } = await props.params;

  // A malformed id would make Postgres error on the uuid cast; a 404 is the
  // truthful response to "/clients/not-a-uuid".
  if (!z.uuid().safeParse(clientId).success) notFound();

  const detail = await getClientDetail(supabase, clientId);
  if (!detail) notFound();

  const { client, thread } = detail;

  // Reply to the oldest unanswered inquiry: working a queue front-to-back is
  // how a backlog gets cleared, and it is the message that has waited longest.
  const openInbound =
    thread.find((message) => message.direction === 'inbound' && !message.is_handled) ??
    null;
  const latestInbound = [...thread]
    .reverse()
    .find((message) => message.direction === 'inbound');

  const replyTarget = openInbound ?? latestInbound ?? null;
  // "Re: " once, not "Re: Re: ".
  const defaultSubject = replyTarget?.subject
    ? `Re: ${replyTarget.subject.replace(/^\s*(re:\s*)+/i, '')}`
    : '';

  // Only inbound text is scanned. A date the studio typed in an earlier reply is
  // not the client asking about a date.
  const inboundText = thread
    .filter((message) => message.direction === 'inbound')
    .map((message) => `${message.subject ?? ''}\n${message.body}`)
    .join('\n\n');
  const suggestedDate = findRequestedDate(inboundText);

  const conflicts = suggestedDate ? await gigsOnDate(supabase, suggestedDate) : [];

  return (
    <>
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to inbox
      </Link>

      <PageHeader
        title={client.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge tone={CLIENT_STAGE_TONES[client.stage]}>
              {CLIENT_STAGE_LABELS[client.stage]}
            </Badge>
            <span>From {CLIENT_SOURCE_LABELS[client.source]}</span>
            <span aria-hidden="true">·</span>
            <span>Last contacted {shortDate(client.last_contacted_at)}</span>
            {client.email ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{client.email}</span>
              </>
            ) : null}
          </span>
        }
      />

      {suggestedDate ? (
        <Card className="mb-6">
          <CardBody className="flex flex-wrap items-start gap-3">
            <CalendarClock
              size={17}
              className="mt-0.5 shrink-0 text-muted"
              aria-hidden="true"
            />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">
                They seem to be asking about {formatDateOnly(suggestedDate)}
              </p>
              {conflicts.length === 0 ? (
                <p className="mt-0.5 text-muted">
                  Nothing is on the calendar that day. Confirm the date in the
                  reply panel and the draft may say it is open.
                </p>
              ) : (
                <p className="mt-0.5 text-muted">
                  Already committed:{' '}
                  {conflicts
                    .map((gig) => `${gig.title} (${gig.status})`)
                    .join(', ')}
                  . A draft using this date will say it is booked.
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <MessageThread
            clientId={client.id}
            clientName={client.name}
            thread={thread}
          />

          <ReplyComposer
            clientId={client.id}
            clientEmail={client.email}
            inReplyToMessageId={openInbound?.id ?? null}
            defaultSubject={defaultSubject}
            suggestedDate={suggestedDate}
            // Read on the server: a disabled-with-a-reason control beats a
            // button that throws when it is pressed.
            aiEnabled={isAiConfigured()}
          />
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <ClientRecordForm client={client} />
        </div>
      </div>
    </>
  );
}
