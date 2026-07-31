/**
 * Input and model-output validation for the Clients module.
 *
 * Two different jobs live here and they are not the same job:
 *
 *  - Form input is validated because Server Actions are reachable by direct
 *    POST, so nothing the browser sends can be trusted to be well formed.
 *  - Model output is validated because it is generated text. It arrives from an
 *    LLM, gets shown to a photographer, and may end up in an email to a paying
 *    client. It is checked for shape and bounds before it is allowed anywhere
 *    near the database.
 */

import { z } from 'zod';
import { CLIENT_SOURCES, CLIENT_STAGES } from '@lensello/core';

const uuid = z.uuid('Expected a client id.');

/** '' from an empty form control means "not provided", not empty-string data. */
const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Keep this under ${max} characters.`)
    .transform((value) => value.trim())
    .transform((value) => (value === '' ? null : value));

// --- the client record --------------------------------------------------

export const clientRecordSchema = z.object({
  clientId: uuid,
  name: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, 'A name is required.')
    .refine((value) => value.length <= 200, 'Keep the name under 200 characters.'),
  // Lower-cased, not merely trimmed. `clients_email_normalised` in
  // 0004_clients.sql rejects anything else, and matching an inbound sender to
  // this client depends on the stored value already being normalised.
  email: z
    .string()
    .max(320, 'Keep the email under 320 characters.')
    .transform((value) => value.trim().toLowerCase())
    .transform((value) => (value === '' ? null : value))
    .refine(
      (value) => value === null || z.email().safeParse(value).success,
      'Enter a valid email address, or leave it blank.',
    ),
  phone: optionalText(40),
  stage: z.enum(CLIENT_STAGES),
  source: z.enum(CLIENT_SOURCES),
  notes: optionalText(5000),
});

export const stageChangeSchema = z.object({
  clientId: uuid,
  stage: z.enum(CLIENT_STAGES),
});

export const handledSchema = z.object({
  clientId: uuid,
  messageId: z.uuid('Expected a message id.'),
  // Checkbox-free: the button posts the value it wants, so an absent field is
  // an error rather than a silent "false".
  isHandled: z.enum(['true', 'false']).transform((value) => value === 'true'),
});

// --- the facts panel ----------------------------------------------------

/**
 * What the photographer has asserted is true.
 *
 * Every field is optional and a blank field becomes `null`. `null` is
 * meaningful: `buildClientReplyPrompt` turns it into an explicit instruction
 * not to invent that fact. Nothing here has a default value, because a default
 * would be a number nobody actually stood behind.
 */
export const factsInputSchema = z.object({
  /** Dollars, as typed. Converted to cents once validated. */
  startingPrice: z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value === '' ? null : value))
    .refine(
      (value) => value === null || /^\d{1,7}(\.\d{1,2})?$/.test(value),
      'Enter a starting price like 2400 or 2400.00, or leave it blank.',
    )
    .transform((value) => (value === null ? null : Math.round(Number(value) * 100))),
  turnaroundDays: z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value === '' ? null : value))
    .refine(
      (value) => value === null || /^\d{1,3}$/.test(value),
      'Enter turnaround as a whole number of days, or leave it blank.',
    )
    .transform((value) => (value === null ? null : Number(value)))
    .refine(
      (value) => value === null || (value >= 1 && value <= 365),
      'Turnaround should be between 1 and 365 days.',
    ),
  travelPolicy: optionalText(400),
  /** The date the client asked about, so availability can be looked up. */
  requestedDate: z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value === '' ? null : value))
    .refine(
      (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
      'Enter the date as YYYY-MM-DD, or leave it blank.',
    ),
});

export type FactsInput = z.output<typeof factsInputSchema>;

export const draftRequestSchema = factsInputSchema.extend({ clientId: uuid });

// --- sending ------------------------------------------------------------

export const sendReplySchema = z.object({
  clientId: uuid,
  subject: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, 'Give the reply a subject.')
    .refine((value) => value.length <= 200, 'Keep the subject under 200 characters.'),
  body: z
    .string()
    .transform((value) => value.replace(/\r\n/g, '\n').trim())
    .refine((value) => value.length > 0, 'Write a reply before sending.')
    .refine((value) => value.length <= 10000, 'This reply is too long to send.'),
  /** The inbound message this answers, so it can be marked handled. */
  inReplyToMessageId: z
    .string()
    .transform((value) => (value.trim() === '' ? null : value.trim()))
    .refine(
      (value) => value === null || z.uuid().safeParse(value).success,
      'Expected a message id.',
    ),
  /**
   * Whether the body is still exactly what the model produced. The composer
   * reports it; the action does not infer it, and it only ever affects a badge.
   */
  isAiDraft: z.enum(['true', 'false']).transform((value) => value === 'true'),
});

// --- model output -------------------------------------------------------

/**
 * The shape `buildClientReplyPrompt` asks for. A model that returns something
 * else — extra keys, a nested object, an empty body, a 40kB monologue — is
 * treated as a failed generation, not as data.
 */
export const replyDraftSchema = z.object({
  subject: z
    .string()
    .transform((value) => value.replace(/\s+/g, ' ').trim())
    .refine((value) => value.length > 0, 'The draft came back without a subject.')
    .refine((value) => value.length <= 200, 'The draft subject was unusably long.'),
  body: z
    .string()
    .transform((value) => value.replace(/\r\n/g, '\n').trim())
    .refine((value) => value.length > 0, 'The draft came back empty.')
    .refine((value) => value.length <= 6000, 'The draft came back unusably long.'),
});

export type ReplyDraft = z.output<typeof replyDraftSchema>;

/** First message from a failed parse, for surfacing in the UI. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Check the values and try again.';
}
