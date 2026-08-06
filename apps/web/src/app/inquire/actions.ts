'use server';

/**
 * The public inquiry action.
 *
 * Unauthenticated by design — this is the form a prospective client fills in.
 * It is therefore the one action in the app with no `requireUser()` at the top,
 * which makes the schema and the throttle the only things standing between a
 * stranger and the database. Both are treated accordingly.
 *
 * The client's confirmation and the studio's alert are both best effort. The
 * inquiry is already recorded by the time they run, and failing the submission
 * because an email did not go out would tell the client to try again — which
 * would file the inquiry twice.
 */

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { SHOOT_TYPE_LABELS } from '@lensello/core';
import { integrationStatus } from '@lensello/core/integrations';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveMailClient } from '@/lib/mailboxes/queries';
import { notifyInbound } from '@/lib/notifications/notify';
import {
  BUDGET_LABELS,
  firstIssue,
  inquirySchema,
  type InquiryInput,
} from '@/lib/inquiries/schema';
import { InquiryThrottled, submitInquiry } from '@/lib/inquiries/submit';

export interface InquiryState {
  sent: boolean;
  error: string | null;
  /** False when no confirmation actually went out, so the copy can be honest. */
  emailed: boolean;
  /** Shown after a successful submit, when a date was given. */
  availability: 'open' | 'taken' | null;
}

export const INQUIRY_IDLE: InquiryState = {
  sent: false,
  error: null,
  emailed: false,
  availability: null,
};

/**
 * The caller's address, from the proxy header Vercel sets.
 *
 * Falls back to a constant rather than to something spoofable: with no
 * trustworthy address, every caller shares one throttle bucket, which is
 * strict rather than permissive. Trusting a client-supplied header here would
 * make the rate limit opt-out.
 */
async function callerIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

function confirmationBody(input: InquiryInput, available: boolean | null): string {
  const lines = [`Hi ${input.name.split(' ')[0] || input.name},`, ''];

  lines.push(
    `Thanks for getting in touch about ${SHOOT_TYPE_LABELS[input.shootType].toLowerCase()} photography — your enquiry has come through and we'll come back to you personally.`,
  );
  lines.push('');

  if (input.date && available === true) {
    lines.push(`Good news: ${input.date} is currently open in our calendar.`);
    lines.push('');
  } else if (input.date && available === false) {
    lines.push(
      `One note — ${input.date} looks booked at the moment. We'll confirm and suggest nearby dates when we reply.`,
    );
    lines.push('');
  }

  lines.push('For reference, here is what you sent:');
  lines.push('');
  lines.push(`  Shoot: ${SHOOT_TYPE_LABELS[input.shootType]}`);
  if (input.date) lines.push(`  Date: ${input.date}`);
  if (input.headcount !== undefined) lines.push(`  Headcount: ${input.headcount}`);
  if (input.budget) lines.push(`  Budget: ${BUDGET_LABELS[input.budget]}`);
  lines.push('');
  lines.push(input.message);

  return lines.join('\n');
}

export async function submitInquiryAction(
  _previous: InquiryState,
  formData: FormData,
): Promise<InquiryState> {
  const parsed = inquirySchema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? undefined,
    shootType: formData.get('shootType') ?? '',
    date: formData.get('date') ?? undefined,
    headcount: formData.get('headcount') ?? undefined,
    budget: formData.get('budget') || undefined,
    message: formData.get('message') ?? '',
    marketingConsent: formData.get('marketingConsent') ?? '',
    website: formData.get('website') ?? '',
  });

  if (!parsed.success) {
    return { sent: false, error: firstIssue(parsed.error), emailed: false, availability: null };
  }

  // Honeypot tripped. Reported as success and thrown away: telling a bot it
  // was caught only teaches it which field to leave alone next time.
  if (parsed.data.website) {
    return { sent: true, error: null, emailed: false, availability: null };
  }

  const input = parsed.data;
  const admin = createAdminClient();

  let outcome;
  try {
    outcome = await submitInquiry(admin, input, await callerIp());
  } catch (cause) {
    if (cause instanceof InquiryThrottled) {
      return { sent: false, error: cause.message, emailed: false, availability: null };
    }
    console.error('[inquiry] could not record', cause);
    return {
      sent: false,
      error: 'Something went wrong sending that. Please try again in a moment.',
      emailed: false,
      availability: null,
    };
  }

  // --- best effort from here; the inquiry is already safe ---

  // Tracked rather than assumed. With no mailbox connected and no Postmark,
  // the registry hands back the MOCK, which "succeeds" and sends nothing — so
  // telling the client "we've sent a confirmation" would be a plain lie on the
  // first screen a prospective customer ever sees.
  let emailed = false;
  try {
    const { mail, mailbox } = await resolveMailClient(admin, admin);
    const live = mailbox !== null || integrationStatus().mail === 'live';
    await mail.send({
      toEmail: input.email,
      toName: input.name,
      subject: `We got your ${SHOOT_TYPE_LABELS[input.shootType].toLowerCase()} enquiry`,
      body: confirmationBody(input, outcome.dateAvailable),
    });
    emailed = live;
  } catch (cause) {
    console.error('[inquiry] confirmation email failed', cause);
  }

  const availabilityNote =
    outcome.dateAvailable === null
      ? ''
      : outcome.dateAvailable
        ? `\n\n${input.date} is OPEN in the calendar.`
        : `\n\n${input.date} has ${outcome.conflictCount} conflicting booking(s).`;

  await notifyInbound(
    [
      {
        fromName: input.name,
        fromEmail: input.email,
        subject: `${SHOOT_TYPE_LABELS[input.shootType]} enquiry from the website`,
        body: `${input.message}${availabilityNote}`,
      },
    ],
    'https://lensello-web-kappa.vercel.app',
  );

  revalidatePath('/clients');

  return {
    sent: true,
    error: null,
    emailed,
    availability:
      outcome.dateAvailable === null ? null : outcome.dateAvailable ? 'open' : 'taken',
  };
}
