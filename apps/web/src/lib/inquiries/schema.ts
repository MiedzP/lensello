/**
 * Validation for the public inquiry form.
 *
 * This is the only unauthenticated write path in the app, so the schema is the
 * security boundary as much as the usability one. Every field is bounded —
 * an unbounded text field on a public endpoint is a free database-filling
 * service.
 */

import { z } from 'zod';
import { SHOOT_TYPES } from '@lensello/core';

export const MAX_MESSAGE_LENGTH = 2000;

/**
 * The exact marketing consent wording.
 *
 * Exported so the form renders it and the submit handler stores it verbatim as
 * evidence. "They ticked a box" is not a defence if nobody can say what the box
 * said, and a constant is the only way to guarantee the two never drift apart.
 */
export const MARKETING_CONSENT_WORDING =
  'Yes — you can email me occasional availability, offers and new work. ' +
  'I can unsubscribe at any time.';

/** Bands rather than a number: people know their range, not their figure. */
export const BUDGET_BANDS = [
  'under_1000',
  '1000_2500',
  '2500_5000',
  '5000_plus',
  'unsure',
] as const;

export type BudgetBand = (typeof BUDGET_BANDS)[number];

export const BUDGET_LABELS: Record<BudgetBand, string> = {
  under_1000: 'Under $1,000',
  '1000_2500': '$1,000 – $2,500',
  '2500_5000': '$2,500 – $5,000',
  '5000_plus': '$5,000+',
  unsure: 'Not sure yet',
};

export const inquirySchema = z.object({
  name: z.string().trim().min(1, 'Please add your name.').max(120),
  email: z.string().trim().email('That email address does not look right.').max(254),
  phone: z.string().trim().max(40).optional(),

  shootType: z.enum(SHOOT_TYPES, { message: 'Pick the kind of shoot.' }),

  // Optional: plenty of enquiries arrive before a date is settled, and forcing
  // one would make people invent it.
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a real date.')
    .optional()
    .or(z.literal('').transform(() => undefined)),

  headcount: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .refine(
      (value) => value === undefined || (Number.isInteger(value) && value >= 0 && value <= 100000),
      'Guest count should be a whole number.',
    ),

  budget: z.enum(BUDGET_BANDS).optional(),

  message: z
    .string()
    .trim()
    .min(1, 'Tell us a little about the shoot.')
    .max(MAX_MESSAGE_LENGTH, `Please keep it under ${MAX_MESSAGE_LENGTH} characters.`),

  /**
   * Marketing consent, separate from the enquiry itself.
   *
   * Replying to an enquiry needs no consent — that is the whole point of
   * sending it. Marketing does, and bundling the two would make the consent
   * neither freely given nor specific, which is to say not consent.
   */
  marketingConsent: z
    .union([z.literal('on'), z.literal('')])
    .optional()
    .transform((value) => value === 'on'),

  /**
   * Honeypot. Hidden from humans by CSS and left blank by them; bots fill
   * every field they find. A filled value is silently accepted and discarded,
   * because telling a bot it failed only teaches it to try again differently.
   */
  website: z.string().max(0).optional().or(z.string().transform(() => 'trap')),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Please check the form and try again.';
}
