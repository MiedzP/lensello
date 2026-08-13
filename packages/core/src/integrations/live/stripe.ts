/**
 * Live payment adapter: Stripe.
 *
 * The one place custom-first gives way, and for a good reason: handling card
 * details directly would put the studio in PCI scope, which is a compliance
 * programme rather than a feature. Stripe holds the card; Lensello holds the
 * deposit logic, the records, and the interface.
 *
 * Checkout Sessions rather than raw PaymentIntents, because the client needs a
 * page they can be sent a link to. Raw `fetch` rather than the Stripe SDK to
 * keep this package free of a heavy dependency it would use three endpoints of.
 *
 * NOT VERIFIED against live Stripe — that needs an account and keys. Request
 * shapes follow Stripe's documented form-encoded API.
 */

import { IntegrationError } from '../types';
import { currencyCode } from '../../types';
import type { CheckoutInput, PaymentClient, PaymentRequest, PaymentStatus } from '../types';

const API_BASE = 'https://api.stripe.com/v1';

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

function requireKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new IntegrationError('Stripe is not configured. Set STRIPE_SECRET_KEY.', 'stripe');
  }
  return key;
}

interface StripeErrorBody {
  error?: { message?: string; type?: string; code?: string };
}

/**
 * Stripe takes form-encoded bodies with bracketed keys for nesting, e.g.
 * `line_items[0][price_data][currency]`. Flattening here keeps call sites
 * readable rather than making every caller build that by hand.
 */
function flatten(value: unknown, prefix = '', into = new URLSearchParams()): URLSearchParams {
  if (value === null || value === undefined) return into;

  if (Array.isArray(value)) {
    value.forEach((entry, index) => flatten(entry, `${prefix}[${index}]`, into));
    return into;
  }

  if (typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      flatten(entry, prefix ? `${prefix}[${key}]` : key, into);
    }
    return into;
  }

  into.set(prefix, String(value));
  return into;
}

async function call<T>(
  path: string,
  options: { method?: string; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const key = requireKey();

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Stripe deduplicates retries on this. Without it, a network timeout
        // followed by a retry can create two payment requests for one deposit.
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      body: options.body ? flatten(options.body).toString() : undefined,
    });
  } catch (cause) {
    throw new IntegrationError(
      `Could not reach Stripe: ${cause instanceof Error ? cause.message : 'network error'}.`,
      'stripe',
      true,
    );
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new IntegrationError(
      `Stripe returned a non-JSON response (HTTP ${response.status}).`,
      'stripe',
      response.status >= 500,
    );
  }

  if (!response.ok) {
    const body = parsed as StripeErrorBody;
    throw new IntegrationError(
      `Stripe: ${body.error?.message ?? `HTTP ${response.status}`}`,
      'stripe',
      response.status === 429 || response.status >= 500,
    );
  }

  return parsed as T;
}

interface CheckoutSession {
  id: string;
  url: string | null;
  amount_total: number | null;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  status: 'open' | 'complete' | 'expired';
}

/**
 * Stripe's two status fields answer different questions, and collapsing them
 * loses the one that matters. `status` is about the session; `payment_status`
 * is about the money. An expired session that was never paid is failed; an
 * open one is still pending.
 */
function toStatus(session: CheckoutSession): PaymentStatus {
  if (session.payment_status === 'paid') return 'paid';
  if (session.status === 'expired') return 'failed';
  return 'pending';
}

class StripePaymentClient implements PaymentClient {
  readonly provider = 'stripe';

  async requestPayment(input: {
    gigId: string;
    amountCents: number;
    description: string;
    clientEmail: string | null;
  }): Promise<PaymentRequest> {
    const returnUrl =
      process.env.LENSELLO_PUBLIC_URL?.trim() || 'https://lensello-web-kappa.vercel.app';

    return this.createSession({
      // Keyed on the gig and amount, so a double-click or a retried request
      // reuses the same session rather than billing the client twice.
      idempotencyKey: `gig:${input.gigId}:${input.amountCents}`,
      amountCents: input.amountCents,
      currency: currencyCode(),
      description: input.description,
      customerEmail: input.clientEmail,
      successUrl: `${returnUrl}/paid?gig=${input.gigId}`,
      cancelUrl: `${returnUrl}/paid?gig=${input.gigId}&cancelled=1`,
      // Echoed back on the webhook, which is how a settlement is matched to
      // a gig without trusting anything in the return URL.
      metadata: { gigId: input.gigId },
      clientReferenceId: input.gigId,
    });
  }

  /**
   * Generic checkout for anything that is not a gig deposit/balance — a print
   * order today. Shares the session-creation path with `requestPayment` so a
   * fix to one (idempotency, currency, error handling) is not silently absent
   * from the other.
   */
  async createCheckout(input: CheckoutInput): Promise<PaymentRequest> {
    return this.createSession({
      idempotencyKey: `checkout:${input.referenceId}:${input.amountCents}`,
      amountCents: input.amountCents,
      currency: input.currency,
      description: input.description,
      customerEmail: input.customerEmail,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata: input.metadata,
      clientReferenceId: input.referenceId,
    });
  }

  private async createSession(input: {
    idempotencyKey: string;
    amountCents: number;
    currency: string;
    description: string;
    customerEmail: string | null;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
    clientReferenceId: string;
  }): Promise<PaymentRequest> {
    const session = await call<CheckoutSession>('/checkout/sessions', {
      method: 'POST',
      idempotencyKey: input.idempotencyKey,
      body: {
        mode: 'payment',
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
        metadata: input.metadata,
        client_reference_id: input.clientReferenceId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.amountCents,
              product_data: { name: input.description },
            },
          },
        ],
      },
    });

    if (!session.url) {
      throw new IntegrationError(
        'Stripe created a checkout session with no payment URL.',
        'stripe',
      );
    }

    return {
      externalId: session.id,
      url: session.url,
      amountCents: session.amount_total ?? input.amountCents,
      status: toStatus(session),
    };
  }

  async getPayment(externalId: string): Promise<PaymentRequest> {
    const session = await call<CheckoutSession>(
      `/checkout/sessions/${encodeURIComponent(externalId)}`,
    );

    return {
      externalId: session.id,
      url: session.url ?? '',
      amountCents: session.amount_total ?? 0,
      status: toStatus(session),
    };
  }
}

export function createStripePaymentClient(): PaymentClient {
  return new StripePaymentClient();
}
