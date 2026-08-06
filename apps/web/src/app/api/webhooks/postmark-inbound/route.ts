/**
 * Inbound email webhook.
 *
 * Postmark POSTs one JSON body per received message. This is what makes a
 * client's email appear in the reply queue within seconds instead of whenever
 * somebody remembers to press Sync.
 *
 * Authentication is a secret in the query string, compared in constant time.
 * Postmark does not sign inbound webhooks, so a URL secret is the mechanism it
 * actually supports — which means the webhook URL *is* a credential and must
 * not be shared or logged. It fails closed: with `POSTMARK_WEBHOOK_SECRET`
 * unset the endpoint refuses every request rather than accepting anonymous
 * mail into the client book.
 *
 * The payload is validated rather than trusted. This endpoint is reachable by
 * anyone who learns the URL, and it writes rows into `clients` and `messages`.
 */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { toInboundMessage } from '@lensello/core/integrations';
import { createAdminClient } from '@/lib/supabase/admin';
import { fileInboundMessages } from '@/lib/clients/sync';
import { notifyInbound } from '@/lib/notifications/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Deliberately loose: Postmark sends far more fields than we use, and a strict
 * schema would reject a whole inquiry because an unrelated field changed
 * shape. Only what gets written is constrained.
 */
const payloadSchema = z.object({
  MessageID: z.string().min(1),
  From: z.string().optional(),
  FromName: z.string().optional(),
  FromFull: z.object({ Email: z.string(), Name: z.string().optional() }).optional(),
  Subject: z.string().optional(),
  TextBody: z.string().optional(),
  StrippedTextReply: z.string().optional(),
  HtmlBody: z.string().optional(),
  Date: z.string().optional(),
  ReceivedAt: z.string().optional(),
});

function authorized(request: Request): boolean {
  const secret = process.env.POSTMARK_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  const supplied = new URL(request.url).searchParams.get('secret') ?? '';
  const a = Buffer.from(supplied, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function originOf(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : 'https://lensello-web-kappa.vercel.app';
}

export async function POST(request: Request) {
  if (!process.env.POSTMARK_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json(
      { error: 'POSTMARK_WEBHOOK_SECRET is not set, so inbound mail is disabled.' },
      { status: 503 },
    );
  }

  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body is not JSON.' }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[inbound] rejected payload', parsed.error.issues[0]);
    return NextResponse.json({ error: 'Unrecognised payload.' }, { status: 400 });
  }

  const message = toInboundMessage(parsed.data);
  if (!message) {
    // No usable sender or id. 200 on purpose: Postmark retries non-2xx, and
    // retrying this would fail identically forever.
    console.warn('[inbound] dropped a message with no usable sender or id');
    return NextResponse.json({ filed: 0, reason: 'unusable' });
  }

  // Service role: a webhook has no session, and `clients`/`messages` are behind
  // is_staff().
  const admin = createAdminClient();

  let result;
  try {
    result = await fileInboundMessages(admin, [message]);
  } catch (cause) {
    // Non-2xx so Postmark retries — a database blip should not lose an inquiry.
    console.error('[inbound] could not file the message', cause);
    return NextResponse.json({ error: 'Could not file the message.' }, { status: 500 });
  }

  revalidatePath('/clients');

  // Only alert on something genuinely new. A Postmark retry of a message we
  // already filed produces newMessages: 0, and must not re-notify.
  if (result.newMessages > 0) {
    await notifyInbound(
      [
        {
          fromName: message.fromName,
          fromEmail: message.fromEmail,
          subject: message.subject,
          body: message.body,
        },
      ],
      originOf(request),
    );
  }

  console.log(
    `[inbound] filed ${result.newMessages} new, ${result.newClients} new clients`,
  );

  return NextResponse.json({
    filed: result.newMessages,
    newClients: result.newClients,
  });
}
