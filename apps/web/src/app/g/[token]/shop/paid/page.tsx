import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Info } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Order confirmation',
  robots: { index: false, follow: false },
};

/**
 * Where Stripe returns the client after checkout — same trade-off as the
 * gigs `/paid` page: this does not itself confirm the payment. The webhook is
 * the source of truth for whether the order actually settled; this only
 * reports what the browser just did.
 */
export default async function ShopPaidPage(props: PageProps<'/g/[token]/shop/paid'>) {
  const { token } = await props.params;
  const params = await props.searchParams;
  const cancelled = params.cancelled === '1';

  if (cancelled) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <Info size={26} className="mx-auto text-muted" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">Checkout cancelled</h1>
        <p className="mt-2 text-sm text-muted">
          Nothing has been charged. Your basket is still there if you would like to try again.
        </p>
        <Link href={`/g/${token}/shop`} className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Back to your basket
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <CheckCircle2 size={26} className="mx-auto text-success" aria-hidden="true" />
      <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">Thank you for your order</h1>
      <p className="mt-2 text-sm text-muted">
        Your payment has gone through and the studio has been sent your order. You&apos;ll get an email receipt from
        Stripe, and the studio will be in touch once it ships.
      </p>
      <p className="mt-4 text-xs text-faint">
        You can close this page. If anything looks wrong, reply to the studio directly and they will check it.
      </p>
    </div>
  );
}
