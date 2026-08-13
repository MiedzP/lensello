'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { Send, Sparkles } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorNote,
  Field,
  Input,
  Textarea,
} from '@/components/ui';
import { formatCents, type DateOnly } from '@lensello/core';
import type { UsedFacts } from '@/lib/clients/draft';
import { formatDateOnly } from '@/lib/clients/format';
import { CHANNEL_LABELS, type MessageChannel } from '@/lib/conversations/channels';
import {
  draftConversationReplyAction,
  sendConversationReplyAction,
  type DraftResult,
} from '../actions';
import { INITIAL_REPLY } from '../form-state';

export interface ReplyPanelProps {
  conversationId: string;
  clientId: string;
  channel: MessageChannel;
  /** Null means "cannot send from here" — the panel says why and stops there. */
  unsendableReason: string | null;
  defaultSubject: string;
  suggestedDate: DateOnly | null;
  aiEnabled: boolean;
}

/**
 * Reply panel: facts, draft, edit, send — the Clients module's composer,
 * adapted to a conversation and a channel instead of a client and an inbound
 * message id. See `lib/clients/draft.ts` for the anti-hallucination contract
 * the facts panel exists to enforce; nothing about it changes here.
 */
export function ReplyPanel(props: ReplyPanelProps) {
  const [sendState, sendAction, sending] = useActionState(
    sendConversationReplyAction,
    INITIAL_REPLY,
  );

  if (props.unsendableReason) {
    return (
      <Card>
        <CardHeader title="Reply" />
        <CardBody>
          <ErrorNote>{props.unsendableReason}</ErrorNote>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Reply"
        description={`Sends by ${CHANNEL_LABELS[props.channel]}.`}
      />

      <CardBody className="space-y-5">
        {sendState.error ? <ErrorNote>{sendState.error}</ErrorNote> : null}

        {sendState.sent && !sendState.error ? (
          <div className="rounded-md border border-success/30 bg-success-subtle px-4 py-3">
            <p className="text-sm font-medium text-success">Reply sent and recorded in the thread.</p>
          </div>
        ) : null}

        <ReplyForm
          key={sendState.sentCount}
          {...props}
          action={sendAction}
          sending={sending}
        />
      </CardBody>
    </Card>
  );
}

function ReplyForm({
  conversationId,
  clientId,
  channel,
  defaultSubject,
  suggestedDate,
  aiEnabled,
  action,
  sending,
}: ReplyPanelProps & {
  action: (formData: FormData) => void;
  sending: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');

  const [aiBody, setAiBody] = useState<string | null>(null);
  const [usedFacts, setUsedFacts] = useState<UsedFacts | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [drafting, startDrafting] = useTransition();

  function handleDraft() {
    const form = formRef.current;
    if (!form) return;

    setDraftError(null);
    const formData = new FormData(form);

    startDrafting(async () => {
      const result: DraftResult = await draftConversationReplyAction(formData);
      if (result.error || !result.draft) {
        setDraftError(result.error ?? 'Drafting failed. Please try again.');
        return;
      }
      setSubject(result.draft.subject);
      setBody(result.draft.body);
      setAiBody(result.draft.body);
      setUsedFacts(result.usedFacts);
    });
  }

  const isUneditedAiDraft = aiBody !== null && body === aiBody;
  const canSend = body.trim().length > 0 && !sending;
  const isEmail = channel === 'email';

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="isAiDraft" value={isUneditedAiDraft ? 'true' : 'false'} />

      <FactsPanel suggestedDate={suggestedDate} />

      <div className="flex flex-wrap items-center gap-3">
        {aiEnabled ? (
          <>
            <Button type="button" onClick={handleDraft} disabled={drafting}>
              <Sparkles size={15} aria-hidden="true" />
              {drafting ? 'Drafting…' : 'Draft with AI'}
            </Button>
            <p className="text-xs text-faint">
              Drafts are never sent automatically. You review, edit, then send.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted">
            AI drafting is unavailable — <code>ANTHROPIC_API_KEY</code> is not set.
          </p>
        )}
      </div>

      {draftError ? <ErrorNote>{draftError}</ErrorNote> : null}
      {usedFacts ? <FactsSummary facts={usedFacts} /> : null}

      {isEmail ? (
        <Field label="Subject" htmlFor="subject" required>
          <Input
            id="subject"
            name="subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Re: your inquiry"
            maxLength={200}
            required
          />
        </Field>
      ) : null}

      <Field
        label="Message"
        htmlFor="body"
        required
        hint={
          isUneditedAiDraft
            ? 'AI-generated text, unedited. Read it before sending — it will be recorded as an AI draft.'
            : undefined
        }
      >
        <Textarea
          id="body"
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write your reply…"
          className="min-h-56"
          maxLength={10000}
          required
        />
      </Field>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {aiBody !== null ? (
          <Badge tone={isUneditedAiDraft ? 'warning' : 'neutral'}>
            {isUneditedAiDraft ? (
              <>
                <Sparkles size={11} className="mr-1" aria-hidden="true" />
                AI draft, unedited
              </>
            ) : (
              'Edited by you'
            )}
          </Badge>
        ) : null}
        <Button type="submit" variant="primary" disabled={!canSend}>
          <Send size={15} aria-hidden="true" />
          {sending ? 'Sending…' : 'Send reply'}
        </Button>
      </div>
    </form>
  );
}

function FactsPanel({ suggestedDate }: { suggestedDate: DateOnly | null }) {
  return (
    <fieldset className="rounded-md border border-subtle bg-surface-raised px-4 py-4">
      <legend className="px-1 text-xs font-medium tracking-wide text-muted uppercase">
        What&apos;s true today
      </legend>
      <p className="mb-4 text-xs text-muted">
        A draft may only state what you put here. Leave a field blank and the AI
        will offer to follow up rather than guess.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starting price" htmlFor="startingPrice" hint="In dollars. Blank means no price is quoted.">
          <Input id="startingPrice" name="startingPrice" inputMode="decimal" placeholder="2400" autoComplete="off" />
        </Field>

        <Field label="Turnaround (days)" htmlFor="turnaroundDays" hint="Blank means no timeline is promised.">
          <Input id="turnaroundDays" name="turnaroundDays" inputMode="numeric" placeholder="21" autoComplete="off" />
        </Field>

        <Field
          label="Travel policy"
          htmlFor="travelPolicy"
          hint="Blank means travel is not mentioned."
          className="sm:col-span-2"
        >
          <Input
            id="travelPolicy"
            name="travelPolicy"
            placeholder="First 50 miles included, then $0.65 a mile"
            maxLength={400}
            autoComplete="off"
          />
        </Field>

        <Field
          label="Date they asked about"
          htmlFor="requestedDate"
          hint={
            suggestedDate
              ? 'Read from the thread — correct it if it is wrong.'
              : 'No single date found in the thread.'
          }
          className="sm:col-span-2"
        >
          <Input id="requestedDate" name="requestedDate" type="date" defaultValue={suggestedDate ?? ''} />
        </Field>
      </div>
    </fieldset>
  );
}

function FactsSummary({ facts }: { facts: UsedFacts }) {
  const allowed: string[] = [];
  const withheld: string[] = [];

  if (facts.requestedDate && facts.isDateAvailable !== null) {
    allowed.push(
      `${formatDateOnly(facts.requestedDate)} is ${facts.isDateAvailable ? 'open' : 'already booked'}`,
    );
  } else {
    withheld.push('date availability');
  }

  if (facts.startingPriceCents !== null) {
    allowed.push(`pricing starts at ${formatCents(facts.startingPriceCents)}`);
  } else {
    withheld.push('pricing');
  }

  if (facts.typicalTurnaroundDays !== null) {
    allowed.push(`${facts.typicalTurnaroundDays}-day turnaround`);
  } else {
    withheld.push('turnaround');
  }

  if (facts.travelPolicy !== null) {
    allowed.push('your travel policy');
  } else {
    withheld.push('travel');
  }

  return (
    <div className="rounded-md border border-subtle bg-surface-raised px-4 py-3 text-xs">
      <p className="font-medium text-foreground">Facts this draft was allowed to use</p>
      <p className="mt-1 text-muted">
        {allowed.length > 0 ? allowed.join('; ') : 'Nothing — no facts were supplied.'}
      </p>
      {withheld.length > 0 ? (
        <p className="mt-1 text-faint">Withheld, with instructions not to guess: {withheld.join(', ')}.</p>
      ) : null}
    </div>
  );
}
