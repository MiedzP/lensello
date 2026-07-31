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
import {
  INITIAL_SEND,
  draftReplyAction,
  sendReplyAction,
  type DraftResult,
} from '../actions';
import { StageOffer } from './stage-offer';

export interface ReplyComposerProps {
  clientId: string;
  clientEmail: string | null;
  /** Newest inbound message still needing a reply, if there is one. */
  inReplyToMessageId: string | null;
  defaultSubject: string;
  /** Date read out of the thread, for the photographer to confirm or correct. */
  suggestedDate: DateOnly | null;
  aiEnabled: boolean;
}

/**
 * Reply panel: facts, draft, edit, send.
 *
 * Split in two on purpose. The outer component owns the send action and its
 * result; the inner form owns the editable text and is keyed on `sentCount`, so
 * a *successful* send remounts it and clears the composer. A failed send leaves
 * the key alone and the photographer keeps everything they typed.
 */
export function ReplyComposer(props: ReplyComposerProps) {
  const [sendState, sendAction, sending] = useActionState(
    sendReplyAction,
    INITIAL_SEND,
  );

  return (
    <Card>
      <CardHeader
        title="Reply"
        description={
          props.clientEmail
            ? `Sends to ${props.clientEmail} through the mail integration.`
            : 'This client has no email address yet — add one on the record to reply.'
        }
      />

      <CardBody className="space-y-5">
        {sendState.error ? <ErrorNote>{sendState.error}</ErrorNote> : null}

        {/* Above the form, not inside it: a stage change is its own submission
            and forms cannot nest. */}
        {sendState.sent && !sendState.error ? (
          <div className="rounded-md border border-success/30 bg-success-subtle px-4 py-3">
            <p className="text-sm font-medium text-success">
              Reply sent and recorded in the thread.
            </p>
            {sendState.suggestedStage ? (
              <StageOffer
                key={sendState.sentCount}
                clientId={props.clientId}
                stage={sendState.suggestedStage}
              />
            ) : null}
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
  clientId,
  clientEmail,
  inReplyToMessageId,
  defaultSubject,
  suggestedDate,
  aiEnabled,
  action,
  sending,
}: ReplyComposerProps & {
  action: (formData: FormData) => void;
  sending: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');

  /**
   * The exact text the model produced, so "has a human touched this?" is a
   * comparison rather than a guess. It is the only thing that sets
   * `is_ai_draft`.
   */
  const [aiBody, setAiBody] = useState<string | null>(null);
  const [usedFacts, setUsedFacts] = useState<UsedFacts | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [drafting, startDrafting] = useTransition();

  function handleDraft() {
    const form = formRef.current;
    if (!form) return;

    setDraftError(null);
    // The facts controls live inside this form, so the action receives exactly
    // what is on screen — nothing implied, nothing remembered from last time.
    const formData = new FormData(form);

    startDrafting(async () => {
      const result: DraftResult = await draftReplyAction(formData);
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
  const canSend = Boolean(clientEmail) && body.trim().length > 0 && !sending;

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <input type="hidden" name="clientId" value={clientId} />
      <input
        type="hidden"
        name="inReplyToMessageId"
        value={inReplyToMessageId ?? ''}
      />
      <input
        type="hidden"
        name="isAiDraft"
        value={isUneditedAiDraft ? 'true' : 'false'}
      />

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
            Write the reply below, or add the key to <code>.env.local</code> and
            restart the server.
          </p>
        )}
      </div>

      {draftError ? <ErrorNote>{draftError}</ErrorNote> : null}
      {usedFacts ? <FactsSummary facts={usedFacts} /> : null}

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
        {!clientEmail ? (
          <span className="text-xs text-danger">
            Add an email address to this client before replying.
          </span>
        ) : null}
        <Button type="submit" variant="primary" disabled={!canSend}>
          <Send size={15} aria-hidden="true" />
          {sending ? 'Sending…' : 'Send reply'}
        </Button>
      </div>
    </form>
  );
}

/**
 * The facts panel — the anti-hallucination mechanism, not decoration.
 *
 * `buildClientReplyPrompt` only lets the model state what it is handed, and
 * every blank field is passed as `null`, which the prompt turns into an explicit
 * "not provided — do not quote a number" instruction. Two deliberate choices:
 *
 *  - Nothing is pre-filled with a plausible default. A plausible default is
 *    exactly the kind of number nobody actually stands behind.
 *  - Nothing is remembered between drafts. These are the numbers a human is
 *    vouching for in *this* reply, so they get re-affirmed every time rather
 *    than inherited from whatever was true last month.
 *
 * The controls are uncontrolled inputs; `handleDraft` reads them straight out of
 * the form, and the server re-validates everything regardless.
 */
function FactsPanel({ suggestedDate }: { suggestedDate: DateOnly | null }) {
  return (
    <fieldset className="rounded-md border border-subtle bg-surface-raised px-4 py-4">
      <legend className="px-1 text-xs font-medium tracking-wide text-muted uppercase">
        What&apos;s true today
      </legend>
      <p className="mb-4 text-xs text-muted">
        A draft may only state what you put here. Leave a field blank and the AI
        is instructed not to quote it at all — it will offer to follow up rather
        than guess.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Starting price"
          htmlFor="startingPrice"
          hint="In dollars. Blank means no price is quoted."
        >
          <Input
            id="startingPrice"
            name="startingPrice"
            inputMode="decimal"
            placeholder="2400"
            autoComplete="off"
          />
        </Field>

        <Field
          label="Turnaround (days)"
          htmlFor="turnaroundDays"
          hint="Blank means no timeline is promised."
        >
          <Input
            id="turnaroundDays"
            name="turnaroundDays"
            inputMode="numeric"
            placeholder="21"
            autoComplete="off"
          />
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
              ? 'Read from their message — correct it if it is wrong. Availability is looked up against your gigs.'
              : 'No single date found in the thread. Fill this in and availability gets looked up against your gigs.'
          }
          className="sm:col-span-2"
        >
          <Input
            id="requestedDate"
            name="requestedDate"
            type="date"
            defaultValue={suggestedDate ?? ''}
          />
        </Field>
      </div>
    </fieldset>
  );
}

/**
 * What the model was permitted to say, shown after drafting.
 *
 * Makes the boundary auditable: a number in the draft that is not on this list
 * means the model went off-script, and the photographer can see that at a glance
 * instead of taking the output on trust.
 */
function FactsSummary({ facts }: { facts: UsedFacts }) {
  const allowed: string[] = [];
  const withheld: string[] = [];

  if (facts.requestedDate && facts.isDateAvailable !== null) {
    allowed.push(
      `${formatDateOnly(facts.requestedDate)} is ${
        facts.isDateAvailable ? 'open' : 'already booked'
      }`,
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
        <p className="mt-1 text-faint">
          Withheld, with instructions not to guess: {withheld.join(', ')}.
        </p>
      ) : null}
    </div>
  );
}
