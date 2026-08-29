/**
 * AI reply drafting.
 *
 * `buildClientReplyPrompt` takes a `facts` object and forbids the model from
 * inventing prices, dates, availability, package contents, or timelines. This
 * module's entire job is to honour that, which in practice means being willing
 * to pass `null`:
 *
 *  - Price, turnaround and travel policy come from the photographer typing them
 *    into the facts panel. Nothing is defaulted, nothing is inferred from other
 *    clients or past gigs, and a blank field is passed as `null` so the prompt
 *    emits "not provided — do not quote a number".
 *  - `isDateAvailable` is the one fact the app can actually establish, so it is
 *    derived from the `gigs` table — but only for a date a human has confirmed
 *    in the panel. No date, or a failed lookup, is `null`.
 *
 * The result is returned to the caller as text. It is never written to
 * `messages`, and never sent. A human presses send.
 */

import { buildClientReplyPrompt } from '@lensello/core/ai';
import type { DateOnly } from '@lensello/core';
import { AiError, generateJson, isAiConfigured } from '@/lib/ai';
import type { Session } from '@/lib/auth';
import { asClientStage, asClientSource, asMessageDirection } from '@/lib/validators';
import { getClientDetail, isDateAvailable } from './queries';
import { replyDraftSchema, type FactsInput, type ReplyDraft } from './schemas';

type Supabase = Session['supabase'];

/** How many messages of history the model sees. Enough for context, bounded. */
const THREAD_WINDOW = 12;
/** Per-message truncation, so one pasted contract cannot blow the context. */
const MAX_BODY_CHARS = 6000;

/**
 * Exactly what the model was permitted to state, echoed back so the UI can show
 * the photographer the basis for the draft instead of asking them to trust it.
 */
export interface UsedFacts {
  requestedDate: DateOnly | null;
  isDateAvailable: boolean | null;
  startingPriceCents: number | null;
  typicalTurnaroundDays: number | null;
  travelPolicy: string | null;
}

export class DraftError extends Error {}

function truncate(body: string): string {
  if (body.length <= MAX_BODY_CHARS) return body;
  return `${body.slice(0, MAX_BODY_CHARS)}\n[…message truncated…]`;
}

export async function draftClientReply(
  supabase: Supabase,
  clientId: string,
  input: FactsInput,
): Promise<{ draft: ReplyDraft; usedFacts: UsedFacts }> {
  // Belt and braces: the UI hides the button, but an action is reachable by
  // direct POST and `generateJson` would throw an unhandled AiError.
  if (!isAiConfigured()) {
    throw new DraftError(
      'AI drafting is unavailable because ANTHROPIC_API_KEY is not set.',
    );
  }

  const detail = await getClientDetail(supabase, clientId);
  if (!detail) throw new DraftError('That client no longer exists.');

  if (detail.thread.length === 0) {
    throw new DraftError(
      'There is no conversation to reply to yet. Sync the inbox or add a message first.',
    );
  }

  // Availability is looked up, never asserted by the client. The browser sends a
  // date; the answer comes from the gigs table.
  const requestedDate = input.requestedDate;
  const availability = requestedDate
    ? await isDateAvailable(supabase, requestedDate)
    : null;

  const usedFacts: UsedFacts = {
    requestedDate,
    isDateAvailable: availability,
    startingPriceCents: input.startingPrice,
    typicalTurnaroundDays: input.turnaroundDays,
    // The prompt splices this string in as its own line, so it carries its own
    // label. Absent stays absent — the prompt then tells the model not to
    // invent a policy.
    travelPolicy: input.travelPolicy ? `Travel policy: ${input.travelPolicy}` : null,
  };

  const prompt = buildClientReplyPrompt({
    client: {
      name: detail.client.name,
      stage: asClientStage(detail.client.stage),
      source: asClientSource(detail.client.source),
    },
    thread: detail.thread.slice(-THREAD_WINDOW).map((message) => ({
      direction: asMessageDirection(message.direction),
      subject: message.subject,
      body: truncate(message.body),
      sentAt: message.sent_at,
    })),
    facts: {
      isDateAvailable: usedFacts.isDateAvailable,
      startingPriceCents: usedFacts.startingPriceCents,
      typicalTurnaroundDays: usedFacts.typicalTurnaroundDays,
      travelPolicy: usedFacts.travelPolicy,
    },
  });

  let raw: unknown;
  try {
    // A 120-200 word reply plus a subject. Anything near this ceiling is a sign
    // the model ignored the brief, and generateJson turns a truncated response
    // into an AiError rather than half a JSON object.
    raw = await generateJson<unknown>(prompt, { maxTokens: 1024 });
  } catch (cause) {
    throw new DraftError(
      cause instanceof AiError ? cause.message : 'The AI request failed. Please try again.',
    );
  }

  // Model output is untrusted input. Validate the shape and the bounds before
  // it is allowed near the composer, let alone the database.
  const parsed = replyDraftSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DraftError(
      parsed.error.issues[0]?.message ??
        'The AI returned a draft in an unexpected shape. Try again.',
    );
  }

  return { draft: parsed.data, usedFacts };
}
