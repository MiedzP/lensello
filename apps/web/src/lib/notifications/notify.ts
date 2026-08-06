/**
 * Telling a human that a client wrote in.
 *
 * Only unattended arrivals notify. Pressing "Sync inbox" and then receiving an
 * email about what you just watched arrive is noise, and noise is how people
 * learn to ignore an alert — so the webhook calls this and the manual syncs do
 * not.
 *
 * A failure here must never fail the thing that triggered it. The message is
 * already filed and visible in the reply queue; losing the notification is a
 * degraded outcome, losing the message would be a real one.
 */

import { getIntegrations } from '@lensello/core/integrations';
import { createAdminClient } from '@/lib/supabase/admin';

/** Enough to tell whether it needs attention now, without quoting the lot. */
const PREVIEW_LENGTH = 200;
const MAX_PREVIEWS = 5;

export interface InboundAlert {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
}

/**
 * Who gets told.
 *
 * `LENSELLO_NOTIFY_EMAIL` wins when set — a studio may want these going to a
 * shared address rather than to whoever happens to hold the owner account.
 * Otherwise every owner is notified, read from `auth.users` because that is
 * the only place an email address exists.
 */
async function resolveRecipients(): Promise<string[]> {
  const configured = process.env.LENSELLO_NOTIFY_EMAIL?.trim();
  if (configured) {
    return configured
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean);
  }

  const admin = createAdminClient();

  const { data: owners, error } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'owner');

  if (error || !owners?.length) return [];

  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const ownerIds = new Set(owners.map((owner) => owner.id));

  return (users?.users ?? [])
    .filter((user) => ownerIds.has(user.id) && user.email)
    .map((user) => user.email as string);
}

function preview(body: string): string {
  const collapsed = body.replace(/\s+/g, ' ').trim();
  return collapsed.length > PREVIEW_LENGTH
    ? `${collapsed.slice(0, PREVIEW_LENGTH)}…`
    : collapsed;
}

function buildBody(alerts: InboundAlert[], appUrl: string): string {
  const lines: string[] = [];

  for (const alert of alerts.slice(0, MAX_PREVIEWS)) {
    lines.push(`From: ${alert.fromName || alert.fromEmail} <${alert.fromEmail}>`);
    if (alert.subject) lines.push(`Subject: ${alert.subject}`);
    lines.push('');
    lines.push(preview(alert.body));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  if (alerts.length > MAX_PREVIEWS) {
    lines.push(`…and ${alerts.length - MAX_PREVIEWS} more.`);
    lines.push('');
  }

  lines.push(`Reply in Lensello: ${appUrl}/clients`);
  return lines.join('\n');
}

/**
 * Sends one alert to the studio.
 *
 * The shared path for anything a client did that somebody needs to know about:
 * an enquiry arriving, a gallery approved, a contract signed. Never throws —
 * the thing being reported has already happened, and failing the client's
 * action because an alert did not send would be strictly worse.
 */
export async function notifyStudio(
  subject: string,
  body: string,
): Promise<boolean> {
  try {
    const recipients = await resolveRecipients();
    if (recipients.length === 0) {
      console.warn('[notify] nothing sent: no recipient configured');
      return false;
    }

    const { mail } = getIntegrations();
    let sent = false;

    for (const toEmail of recipients) {
      try {
        await mail.send({ toEmail, toName: null, subject, body });
        sent = true;
      } catch (cause) {
        console.error(`[notify] could not alert ${toEmail}`, cause);
      }
    }

    return sent;
  } catch (cause) {
    console.error('[notify] alert failed', cause);
    return false;
  }
}

/**
 * Sends one alert covering everything that just arrived.
 *
 * One email for a batch rather than one per message: a forwarded backlog would
 * otherwise arrive as a dozen separate alerts.
 *
 * Returns whether it sent, for the caller's logs. It never throws.
 */
export async function notifyInbound(
  alerts: InboundAlert[],
  appUrl: string,
): Promise<boolean> {
  if (alerts.length === 0) return false;

  try {
    const recipients = await resolveRecipients();
    if (recipients.length === 0) {
      console.warn('[notify] nothing sent: no owner has an email and LENSELLO_NOTIFY_EMAIL is unset');
      return false;
    }

    const { mail } = getIntegrations();

    const subject =
      alerts.length === 1
        ? `New inquiry from ${alerts[0]!.fromName || alerts[0]!.fromEmail}`
        : `${alerts.length} new client messages`;

    const body = buildBody(alerts, appUrl);

    // Sequential and independent: one bad address must not cost the others
    // their alert.
    for (const toEmail of recipients) {
      try {
        await mail.send({ toEmail, toName: null, subject, body });
      } catch (cause) {
        console.error(`[notify] could not alert ${toEmail}`, cause);
      }
    }

    return true;
  } catch (cause) {
    // Includes the case where mail is not configured at all, which is a normal
    // state before Postmark is set up rather than an error worth surfacing.
    console.error('[notify] alert failed', cause);
    return false;
  }
}
