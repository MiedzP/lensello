'use client';

import { useActionState } from 'react';
import { CalendarCheck, CalendarX, Check } from 'lucide-react';
import { SHOOT_TYPES, SHOOT_TYPE_LABELS } from '@lensello/core';
import {
  Button,
  ErrorNote,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import {
  BUDGET_BANDS,
  BUDGET_LABELS,
  MARKETING_CONSENT_WORDING,
  MAX_MESSAGE_LENGTH,
} from '@/lib/inquiries/schema';
import { submitInquiryAction } from './actions';
import { INQUIRY_IDLE } from './inquiry-state';

export function InquiryForm() {
  const [state, action, pending] = useActionState(
    submitInquiryAction,
    INQUIRY_IDLE,
  );

  if (state.sent) {
    return (
      <div
        role="status"
        className="rounded-lg border border-success/30 bg-success-subtle px-6 py-8 text-center"
      >
        <Check size={24} className="mx-auto text-success" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-foreground">
          Thanks — that&rsquo;s come through.
        </p>
        <p className="mt-1 text-sm text-muted">
          {state.emailed
            ? "We've sent a confirmation to your inbox and will come back to you personally."
            : "We'll come back to you personally."}
        </p>

        {state.availability === 'open' ? (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-success">
            <CalendarCheck size={16} aria-hidden="true" />
            That date is currently open.
          </p>
        ) : null}

        {state.availability === 'taken' ? (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-warning">
            <CalendarX size={16} aria-hidden="true" />
            That date looks booked — we&rsquo;ll suggest alternatives.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

      {/* Honeypot. Hidden from people, irresistible to bots. Not `display:none`
          — some bots skip those; off-screen with no tab stop is skipped by
          humans and screen readers instead. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" required>
          <Input id="name" name="name" autoComplete="name" required autoFocus />
        </Field>

        <Field label="Email" htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor="phone" hint="Optional.">
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </Field>

        <Field label="What kind of shoot?" htmlFor="shootType" required>
          <Select id="shootType" name="shootType" defaultValue="wedding" required>
            {SHOOT_TYPES.map((type) => (
              <option key={type} value={type}>
                {SHOOT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date" htmlFor="date" hint="If you have one.">
          <Input id="date" name="date" type="date" />
        </Field>

        <Field label="Headcount" htmlFor="headcount" hint="Guests or people.">
          <Input id="headcount" name="headcount" inputMode="numeric" />
        </Field>

        <Field label="Budget" htmlFor="budget" hint="Helps us answer properly.">
          <Select id="budget" name="budget" defaultValue="">
            <option value="">Prefer not to say</option>
            {BUDGET_BANDS.map((band) => (
              <option key={band} value={band}>
                {BUDGET_LABELS[band]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Tell us about it"
        htmlFor="message"
        required
        hint="Where it is, what matters most to you, anything you've seen of ours that you liked."
      >
        <Textarea
          id="message"
          name="message"
          rows={5}
          maxLength={MAX_MESSAGE_LENGTH}
          required
        />
      </Field>

      {/* Unticked by default and never required. A pre-ticked box, or one you
          must accept to send the form, is not freely given consent. */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-subtle bg-surface px-3 py-2.5">
        <input
          type="checkbox"
          name="marketingConsent"
          className="mt-0.5 size-4 shrink-0 accent-accent"
        />
        <span className="text-sm text-muted">{MARKETING_CONSENT_WORDING}</span>
      </label>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={pending}
      >
        {pending ? 'Sending…' : 'Send enquiry'}
      </Button>

      <p className="text-center text-xs text-faint">
        We use your details to reply to this enquiry. That does not require the
        box above — leave it unticked and we&rsquo;ll still get back to you.
      </p>
    </form>
  );
}
