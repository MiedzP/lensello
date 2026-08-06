/**
 * Live mail adapter: Postmark.
 *
 * Chosen over the Gmail API because inbound mail here needs no OAuth consent
 * screen and no Google verification review — you point a forwarding rule at an
 * address and messages arrive. That removes an approval gate from the critical
 * path of "a client emails the studio and it shows up in Lensello".
 *
 * Mail arrives by two routes on purpose:
 *
 *  - the inbound webhook, which is how a message shows up within seconds; and
 *  - `fetchInbox`, which polls Postmark's inbound archive and is what the
 *    manual "Sync inbox" button calls.
 *
 * Both funnel into the same idempotent write keyed on `messages.external_id`,
 * so a message that arrives by webhook and is then re-fetched by a sync is
 * filed once. Keeping the pull path alive also means a webhook outage is
 * recoverable by pressing a button rather than by losing the inquiries.
 */

import { IntegrationError } from '../types';
import type { Timestamp } from '../../types';
import type {
  InboundMessage,
  MailClient,
  PublishResult,
  SendMailInput,
} from '../types';

const API_BASE = 'https://api.postmarkapp.com';

/** Postmark caps a single inbound page at 500; 100 keeps a sync responsive. */
const INBOUND_PAGE_SIZE = 100;

export function isPostmarkConfigured(): boolean {
  return Boolean(
    process.env.POSTMARK_SERVER_TOKEN?.trim() && process.env.LENSELLO_FROM_EMAIL?.trim(),
  );
}

function requireConfig(): { token: string; from: string } {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  const from = process.env.LENSELLO_FROM_EMAIL?.trim();

  if (!token || !from) {
    throw new IntegrationError(
      'Postmark is not configured. Set POSTMARK_SERVER_TOKEN and LENSELLO_FROM_EMAIL.',
      'postmark',
    );
  }
  return { token, from };
}

/** Postmark error bodies carry a numeric code and a human message. */
interface PostmarkError {
  ErrorCode?: number;
  Message?: string;
}

async function call<T>(
  token: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch (cause) {
    // Network-level failure: worth retrying, unlike a rejected payload.
    throw new IntegrationError(
      `Could not reach Postmark: ${cause instanceof Error ? cause.message : 'network error'}.`,
      'postmark',
      true,
    );
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as PostmarkError;
      if (body.Message) detail = body.Message;
    } catch {
      // Non-JSON error body; the status code is all we have.
    }

    // 429 and 5xx are transient; 4xx means the request itself was wrong and
    // retrying it unchanged will fail the same way.
    const retryable = response.status === 429 || response.status >= 500;
    throw new IntegrationError(`Postmark: ${detail}`, 'postmark', retryable);
  }

  return (await response.json()) as T;
}

interface PostmarkSendResponse {
  MessageID: string;
  SubmittedAt: string;
}

/**
 * Exported so the webhook can type the body it validates. `From` is optional
 * even though Postmark normally sends it: `toInboundMessage` prefers
 * `FromFull.Email` and rejects a record with neither, so requiring it here
 * would only stop the webhook reusing this type.
 */
export interface PostmarkInboundMessage {
  MessageID: string;
  From?: string;
  FromName?: string;
  FromFull?: { Email: string; Name?: string };
  Subject?: string;
  TextBody?: string;
  StrippedTextReply?: string;
  HtmlBody?: string;
  Date?: string;
  ReceivedAt?: string;
}

interface PostmarkInboundPage {
  TotalCount: number;
  InboundMessages: PostmarkInboundMessage[];
}

/**
 * Best-effort plain text from an HTML body.
 *
 * Deliberately crude. This only runs for senders whose client omitted a text
 * part; anything cleverer would be a HTML parser in a mail adapter, and the
 * text is going into a reply queue a human reads, not into a renderer.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Normalises one Postmark inbound record into the shape the app files.
 *
 * Exported because the webhook receives this same record shape pushed rather
 * than pulled, and the two paths must produce byte-identical rows — otherwise
 * `external_id` dedup would let the same email in twice under two bodies.
 */
export function toInboundMessage(raw: PostmarkInboundMessage): InboundMessage | null {
  const email = (raw.FromFull?.Email ?? raw.From ?? '').trim();
  const externalId = raw.MessageID?.trim();
  if (!email || !externalId) return null;

  // StrippedTextReply drops the quoted thread below a reply, which is what
  // makes a long back-and-forth readable in the queue. Fall back through the
  // full text part, then the HTML.
  const body =
    raw.StrippedTextReply?.trim() ||
    raw.TextBody?.trim() ||
    (raw.HtmlBody ? htmlToText(raw.HtmlBody) : '');

  const receivedRaw = raw.ReceivedAt ?? raw.Date;
  const received = receivedRaw ? new Date(receivedRaw) : new Date();

  return {
    externalId,
    fromName: (raw.FromFull?.Name ?? raw.FromName ?? '').trim(),
    fromEmail: email,
    subject: raw.Subject?.trim() ?? '',
    body,
    receivedAt: (Number.isNaN(received.getTime()) ? new Date() : received).toISOString(),
  };
}

class PostmarkMailClient implements MailClient {
  readonly provider = 'postmark';

  async fetchInbox(since?: Timestamp): Promise<InboundMessage[]> {
    const { token } = requireConfig();

    const params = new URLSearchParams({
      count: String(INBOUND_PAGE_SIZE),
      offset: '0',
    });

    // Postmark filters inbound by calendar date, not by instant, so the
    // window is widened to the whole day. The caller dedupes on external_id,
    // which makes over-fetching free and under-fetching the only real risk.
    if (since) {
      const from = new Date(since);
      if (!Number.isNaN(from.getTime())) {
        params.set('fromdate', from.toISOString().slice(0, 10));
      }
    }

    const page = await call<PostmarkInboundPage>(
      token,
      `/messages/inbound?${params.toString()}`,
    );

    return (page.InboundMessages ?? [])
      .map(toInboundMessage)
      .filter((message): message is InboundMessage => message !== null)
      .sort(
        (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
      );
  }

  async send(input: SendMailInput): Promise<PublishResult> {
    const { token, from } = requireConfig();

    const result = await call<PostmarkSendResponse>(token, '/email', {
      method: 'POST',
      body: {
        From: from,
        To: input.toName ? `${input.toName} <${input.toEmail}>` : input.toEmail,
        Subject: input.subject,
        TextBody: input.body,
        // Threads the reply under the original in the client's mail app.
        ...(input.inReplyTo ? { Headers: [{ Name: 'In-Reply-To', Value: input.inReplyTo }] } : {}),
        MessageStream: process.env.POSTMARK_MESSAGE_STREAM?.trim() || 'outbound',
      },
    });

    return {
      externalId: result.MessageID,
      url: null,
      publishedAt: new Date(result.SubmittedAt).toISOString(),
    };
  }
}

export function createPostmarkMailClient(): MailClient {
  return new PostmarkMailClient();
}
