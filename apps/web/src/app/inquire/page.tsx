import type { Metadata } from 'next';
import { Camera } from 'lucide-react';
import { InquiryForm } from './inquiry-form';

export const metadata: Metadata = {
  title: 'Enquire',
  description: 'Tell us about your shoot and we will come back to you personally.',
};

/**
 * The public front door.
 *
 * Deliberately outside the `(app)` group: no nav, no session, nothing that
 * assumes a signed-in staff member. It is also listed in `proxy.ts` as a
 * public path, or the auth gate would bounce every prospective client to a
 * login screen.
 */
export default function InquirePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
      <div className="mb-8 text-center">
        <Camera size={26} className="mx-auto text-accent" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
          Let&rsquo;s talk about your shoot
        </h1>
        <p className="mx-auto mt-2 max-w-prose text-sm text-muted">
          Tell us what you have in mind. If you give us a date, we&rsquo;ll check
          the calendar and let you know straight away whether it&rsquo;s open.
        </p>
      </div>

      <InquiryForm />
    </div>
  );
}
