import type { Metadata } from 'next';
import { CheckCircle2, Info } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Payment',
  robots: { index: false, follow: false },
};

/**
 * Where Stripe returns the client after checkout.
 *
 * This existed only as a URL in the Stripe adapter until now — clients would
 * have paid and landed on a 404, which is the single worst moment in the whole
 * product to show one.
 *
 * It deliberately does not confirm the payment itself. The browser's return
 * URL is not evidence of anything: it can be opened by hand, and Stripe's own
 * guidance is to treat the webhook as the source of truth. So this page reports
 * what the client did — paid, or backed out — and says the receipt follows,
 * rather than asserting a settlement the app has not been told about yet.
 */
export default async function PaidPage(props: PageProps<'/paid'>) {
  const params = await props.searchParams;
  const cancelled = params.cancelled === '1';

  if (cancelled) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <Info size={26} className="mx-auto text-muted" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
          Payment cancelled
        </h1>
        <p className="mt-2 text-sm text-muted">
          Nothing has been charged. The payment link in your email still works
          if you would like to try again, or reply to the studio and they will
          sort it out.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <CheckCircle2 size={26} className="mx-auto text-success" aria-hidden="true" />
      <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
        Thank you
      </h1>
      <p className="mt-2 text-sm text-muted">
        Your payment has gone through and the studio has been notified. Stripe
        will email you a receipt.
      </p>
      <p className="mt-4 text-xs text-faint">
        You can close this page. If anything looks wrong, reply to the studio
        directly and they will check it.
      </p>
    </div>
  );
}
