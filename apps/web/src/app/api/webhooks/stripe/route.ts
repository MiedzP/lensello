/**
 * Stripe settlement webhook.
 *
 * Replaces the mock payment client's poll-count simulation with the real
 * thing: Stripe tells us when money actually arrived, rather than the app
 * guessing on the second check.
 *
 * The raw body is read as text and verified before anything is parsed. Reading
 * it as JSON first and re-serialising would change the bytes and the signature
 * would never match — a mistake that looks like "Stripe's signatures are
 * broken" rather than like a bug here.
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyStripeSignature } from '@/lib/payments/stripe-signature';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      id?: string;
      client_reference_id?: string | null;
      payment_status?: string;
      amount_total?: number | null;
      metadata?: Record<string, string> | null;
    };
  };
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secret) {
    return NextResponse.json(
      { error: 'STRIPE_WEBHOOK_SECRET is not set, so settlement is disabled.' },
      { status: 503 },
    );
  }

  // Raw, before any parsing. See the module comment.
  const rawBody = await request.text();

  const failure = verifyStripeSignature({
    rawBody,
    header: request.headers.get('stripe-signature'),
    secret,
    nowSeconds: Math.floor(Date.now() / 1000),
  });

  if (failure) {
    console.error(`[stripe] rejected a webhook: ${failure}`);
    return NextResponse.json({ error: 'Signature verification failed.' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: 'Body is not JSON.' }, { status: 400 });
  }

  // Only settlement matters here. Everything else is acknowledged so Stripe
  // stops retrying it — returning an error for an event we simply do not use
  // would fill the dashboard with failures that mean nothing.
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ ignored: event.type });
  }

  const session = event.data.object;
  const gigId = session.metadata?.gigId ?? session.client_reference_id ?? null;
  const sessionId = session.id;

  if (!gigId || !sessionId) {
    console.error('[stripe] settlement event with no gig reference', event.id);
    return NextResponse.json({ error: 'No gig reference on the session.' }, { status: 400 });
  }

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ ignored: 'session completed without payment' });
  }

  const admin = createAdminClient();

  const { data: gig } = await admin
    .from('gigs')
    .select('id, deposit_payment_id, balance_payment_id, deposit_paid_at, balance_paid_at')
    .eq('id', gigId)
    .maybeSingle();

  if (!gig) {
    // 200, not an error: the gig was deleted after the client paid. Stripe
    // retrying will not conjure it back, and the money is a matter for a human.
    console.error(`[stripe] paid session ${sessionId} references missing gig ${gigId}`);
    return NextResponse.json({ ignored: 'gig no longer exists' });
  }

  // Which payment this was is decided by the id recorded when the request was
  // created, not by the amount. Amounts can coincide — a deposit and a balance
  // can be equal — and matching on them would settle the wrong one.
  const paidAt = new Date().toISOString();
  let field: 'deposit_paid_at' | 'balance_paid_at' | null = null;

  if (gig.deposit_payment_id === sessionId) field = 'deposit_paid_at';
  else if (gig.balance_payment_id === sessionId) field = 'balance_paid_at';

  if (!field) {
    console.error(`[stripe] paid session ${sessionId} matches no payment on gig ${gigId}`);
    return NextResponse.json({ ignored: 'session does not match a recorded payment' });
  }

  // Already settled — a Stripe retry, not a second payment.
  if (gig[field]) return NextResponse.json({ ignored: 'already settled' });

  // Spelled out rather than a computed key: a computed key widens to
  // `{ [x: string]: string }`, which no longer matches the row type, and the
  // compiler would stop catching a typo'd column name here.
  const update =
    field === 'deposit_paid_at'
      ? { deposit_paid_at: paidAt }
      : { balance_paid_at: paidAt };

  const { error } = await admin
    .from('gigs')
    .update(update)
    .eq('id', gigId)
    // Guarded so two concurrent deliveries cannot both write it.
    .is(field, null);

  if (error) {
    // Non-2xx so Stripe retries: money arrived and we failed to record it,
    // which is the one case worth being noisy about.
    console.error('[stripe] could not record settlement', error);
    return NextResponse.json({ error: 'Could not record the payment.' }, { status: 500 });
  }

  revalidatePath(`/gigs/${gigId}`);
  revalidatePath('/gigs');

  console.log(`[stripe] recorded ${field} for gig ${gigId}`);
  return NextResponse.json({ recorded: field, gigId });
}
