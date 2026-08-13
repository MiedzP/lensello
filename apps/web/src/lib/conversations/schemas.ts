/** Input validation for the Conversations module's Server Actions. */

import { z } from 'zod';
import { CONVERSATION_STATUSES } from './channels';

const uuid = z.uuid('Expected a conversation id.');
const clientUuid = z.uuid('Expected a client id.');

export const setStatusSchema = z.object({
  conversationId: uuid,
  status: z.enum(CONVERSATION_STATUSES),
  /** Only meaningful when status is 'snoozed'; ignored otherwise. */
  snoozedUntil: z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value === '' ? null : value)),
});

export const assignSchema = z.object({
  conversationId: uuid,
  /** Empty string means "unassigned". */
  assigneeId: z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value === '' ? null : value))
    .refine(
      (value) => value === null || z.uuid().safeParse(value).success,
      'Expected a staff member id.',
    ),
});

export const sendReplySchema = z.object({
  conversationId: uuid,
  subject: z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value === '' ? null : value)),
  body: z
    .string()
    .transform((value) => value.replace(/\r\n/g, '\n').trim())
    .refine((value) => value.length > 0, 'Write a reply before sending.')
    .refine((value) => value.length <= 10000, 'This reply is too long to send.'),
  isAiDraft: z.enum(['true', 'false']).transform((value) => value === 'true'),
});

export const addIdentitySchema = z.object({
  clientId: clientUuid,
  channel: z.enum(['email', 'phone', 'instagram', 'facebook', 'tiktok', 'pinterest', 'whatsapp']),
  identifier: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, 'Enter a value.')
    .refine((value) => value.length <= 320, 'Keep this under 320 characters.'),
  displayName: z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value === '' ? null : value)),
});

export const identityIdSchema = z.object({
  clientId: clientUuid,
  identityId: z.uuid('Expected a contact identity id.'),
});

export const mergeSchema = z.object({
  conversationId: uuid,
  targetClientId: clientUuid,
});

export const searchClientsSchema = z.object({
  query: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length >= 2, 'Type at least 2 characters.'),
});

export const setStageSchema = z.object({
  clientId: clientUuid,
  stage: z.enum(['lead', 'inquiry', 'quoted', 'booked', 'completed', 'lost']),
});

/** First message from a failed parse, for surfacing in the UI. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Check the values and try again.';
}
