/**
 * Input validation for playbooks and the checklist.
 *
 * Same rule as the rest of the app: a Server Action is reachable by direct
 * POST, so every field arriving here is untrusted until a schema says
 * otherwise.
 */

import { z } from 'zod';
import { sanitizePostingDays } from './dates';
import { TASK_KINDS } from './types';

/**
 * Not imported from `@/lib/campaigns/validation`: that module imports
 * `sanitizePostingDays` from here for the campaign-creation form, and a
 * two-way import between the two validation modules is a footgun waiting to
 * surface as "works in the app, breaks in a test runner" depending on
 * evaluation order. A one-line schema is cheaper than that risk.
 */
export const uuidSchema = z.uuid('That is not a valid id.');

export const taskKindSchema = z.enum(TASK_KINDS);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

/** '' becomes null; an untouched optional date input clears the column. */
export const optionalDateSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value === '' || DATE_RE.test(value), {
    message: 'Use a valid date, or leave the field empty.',
  })
  .transform((value) => (value === '' ? null : value));

/** Accepts `HH:mm` (from an `<input type="time">`) or `HH:mm:ss`. */
export const optionalTimeSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value === '' || TIME_RE.test(value), {
    message: 'Use a valid time, or leave the field empty.',
  })
  .transform((value) => (value === '' ? null : value.length === 5 ? `${value}:00` : value));

export const requiredTimeSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => TIME_RE.test(value), { message: 'Pick a time of day.' })
  .transform((value) => (value.length === 5 ? `${value}:00` : value));

/** Multi-checkbox weekday values, coerced and de-duplicated. Empty is legal — a
 * campaign with no posting days simply never gets a post/story task snapped. */
export const postingDaysSchema = z
  .array(z.string())
  .transform((values) =>
    sanitizePostingDays(
      values.map((value) => Number(value)).filter((value) => !Number.isNaN(value)),
    ),
  );

/** '' -> null, so an unselected client/post/assignee <select> clears the column. */
const optionalId = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value === '' || z.uuid().safeParse(value).success, {
    message: 'That could not be identified.',
  })
  .transform((value) => (value === '' ? null : value));

export const applyPlaybookSchema = z.object({
  campaignId: uuidSchema,
  playbookId: uuidSchema,
});

const MAX_TASK_TITLE = 200;
const MAX_TASK_DETAIL = 1000;

export const addCampaignTaskSchema = z.object({
  campaignId: uuidSchema,
  title: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, { message: 'Give the task a title.' })
    .refine((value) => value.length <= MAX_TASK_TITLE, {
      message: `Keep the title under ${MAX_TASK_TITLE} characters.`,
    }),
  detail: z
    .string()
    .max(MAX_TASK_DETAIL, `Keep the detail under ${MAX_TASK_DETAIL} characters.`)
    .transform((value) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
  kind: taskKindSchema,
  dueOn: optionalDateSchema,
  dueTime: optionalTimeSchema,
  clientId: optionalId,
  postId: optionalId,
  assignedTo: optionalId,
});

export const updateCampaignTaskSchema = addCampaignTaskSchema
  .omit({ campaignId: true })
  .extend({ taskId: uuidSchema });

export const toggleCampaignTaskSchema = z.object({
  taskId: uuidSchema,
  done: z.enum(['true', 'false']).transform((value) => value === 'true'),
});

export const rescheduleCampaignTaskSchema = z.object({
  taskId: uuidSchema,
  dueOn: z.string().regex(DATE_RE, 'That is not a valid date.'),
});

export function firstIssue(error: z.ZodError, fallback = 'Check the form and try again.'): string {
  return error.issues[0]?.message ?? fallback;
}
