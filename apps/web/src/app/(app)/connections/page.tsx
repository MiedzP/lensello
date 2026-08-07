import type { Metadata } from 'next';
import { Share2 } from 'lucide-react';
import { getIntegrations, integrationStatus } from '@lensello/core/integrations';
import { Card, CardBody, ErrorNote, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { listConnections } from '@/lib/connections/queries';
import {
  UNSUPPORTED_PLATFORMS,
  isConnectable,
} from '@/lib/connections/links';
import { getPrimaryMailbox } from '@/lib/mailboxes/queries';
import { isEncryptionConfigured } from '@/lib/crypto/secret-box';
import { CalendarCard } from './components/calendar-card';
import { ConnectionCard } from './components/connection-card';
import { MailboxCard, type MailboxView } from './components/mailbox-card';
import { EnquiryFormCard } from './components/enquiry-form-card';
import { SyncMessagesForm } from './components/sync-messages-form';

export const metadata: Metadata = { title: 'Connections' };

/**
 * Fixed copy per outcome code.
 *
 * The callback hands back a code, never a message, so nothing an attacker can
 * put in the query string is rendered on a signed-in page.
 */
const REASON_COPY: Record<string, string> = {
  denied: 'The linking request was cancelled, so nothing changed.',
  state:
    'That link attempt could not be verified and was rejected. Start it again ' +
    'from this page — the request has to begin and end in the same browser, ' +
    'within ten minutes.',
  exchange:
    'The platform refused to complete the link. The authorization code may ' +
    'have already been used. Try connecting again.',
  store:
    'The account was authorized but could not be saved, so it has not been ' +
    'linked. Try again.',
  platform: 'That is not a platform Lensello supports.',
};


const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
};

/** "a", "a and b", "a, b and c" — the list reads as a sentence, not an array. */
function listSentence(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export default async function ConnectionsPage(props: PageProps<'/connections'>) {
  const { supabase } = await requireUserOrRedirect();

  // Promise in Next 16 — synchronous access was removed.
  const params = await props.searchParams;
  const linked = typeof params.linked === 'string' ? params.linked : null;
  const reason = typeof params.reason === 'string' ? params.reason : null;

  const connections = await listConnections(supabase);
  const connectable = connections.filter(({ platform }) => isConnectable(platform));

  const mailbox = await getPrimaryMailbox(supabase);
  const encryptionReady = isEncryptionConfigured();

  const mailboxView: MailboxView | null = mailbox
    ? {
        id: mailbox.id,
        emailAddress: mailbox.email_address,
        displayName: mailbox.display_name,
        imapHost: mailbox.imap_host,
        smtpHost: mailbox.smtp_host,
        status: mailbox.status,
        lastError: mailbox.last_error,
        lastSyncedLabel: mailbox.last_synced_at
          ? new Date(mailbox.last_synced_at).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : 'never',
      }
    : null;

  // `getIntegrations()` throws outright when the mode is `live`, because no
  // live adapter exists yet. Catching it here turns a crashed page into an
  // explanation of what to fix.
  let mode: 'mock' | 'live' | null = null;
  let modeError: string | null = null;
  try {
    mode = getIntegrations().mode;
  } catch (cause) {
    modeError = cause instanceof Error ? cause.message : 'No adapter is available.';
  }

  // Named individually rather than as a fixed sentence: each of these can go
  // live on its own, and a list that keeps naming a capability after it was
  // connected is the same problem in the opposite direction.
  const status = integrationStatus();
  const simulated = [
    status.ads === 'mock' ? 'Ads' : null,
    status.calendar === 'mock' ? 'calendar sync' : null,
    status.payments === 'mock' ? 'payments' : null,
  ].filter((label): label is string => label !== null);

  const anyCollectable = connections.some(
    ({ account }) => account?.status === 'connected' && account.can_collect_messages,
  );

  return (
    <>
      <PageHeader
        title="Connections"
        description="Link the studio's social accounts so campaigns can publish to them and inquiries land in Clients."
        action={anyCollectable ? <SyncMessagesForm /> : undefined}
      />

      {modeError ? <ErrorNote>{modeError}</ErrorNote> : null}

      {reason && REASON_COPY[reason] ? (
        <ErrorNote>{REASON_COPY[reason]}</ErrorNote>
      ) : null}

      {linked ? (
        <Card className="border-success/30 bg-success-subtle">
          <CardBody className="text-sm text-success">
            {linked} is linked. Campaigns can publish to it, and “Collect
            messages” will pull its inbox into Clients.
          </CardBody>
        </Card>
      ) : null}

      {mode === 'mock' && simulated.length > 0 ? (
        <Card className="mt-4">
          <CardBody className="space-y-2 text-sm text-muted">
            <p className="font-medium text-foreground">
              Running against the built-in simulator
            </p>
            <p>
              {listSentence(simulated)}{' '}
              {simulated.length === 1 ? 'still returns' : 'still return'} invented
              data rather than talking to anything. Email and the enquiry form
              above are real as soon as they are set up; social is covered below.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Working now</h2>
        <p className="max-w-prose text-sm text-muted">
          These need nobody&rsquo;s approval and bring real enquiries in today.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <EnquiryFormCard />
          <MailboxCard mailbox={mailboxView} encryptionReady={encryptionReady} />
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Bookings</h2>
        <p className="max-w-prose text-sm text-muted">
          Where confirmed gigs are written, so the studio&rsquo;s diary and this
          app agree about what is booked.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <CalendarCard
            status={status.calendar}
            // Only read back once something is configured: these come from the
            // environment, and showing a half-set value would suggest a
            // connection that the status beside it says does not exist.
            calendarId={
              status.calendar === 'live'
                ? (process.env.GOOGLE_CALENDAR_ID?.trim() ?? null)
                : null
            }
            serviceAccount={
              status.calendar === 'live'
                ? (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? null)
                : null
            }
          />
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Social accounts</h2>
        {connectable.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {connectable.map(({ platform, account }) => (
              <ConnectionCard
                key={platform}
                platform={platform}
                account={account}
                simulated={mode === 'mock'}
              />
            ))}
          </div>
        ) : null}

        <Card>
          <CardBody className="space-y-2 text-sm text-muted">
            <p className="font-medium text-foreground">Not available yet</p>
            <p>
              None of these can be connected, so none is offered. Each needs an
              adapter and that platform&rsquo;s own approval before there is
              anything real to link to. Listed rather than hidden, so the gap is
              visible instead of looking like a missing feature.
            </p>
            <ul className="mt-1 space-y-1.5">
              {UNSUPPORTED_PLATFORMS.map(({ platform, reason }) => (
                <li key={platform} className="text-xs">
                  <span className="font-medium text-foreground">
                    {PLATFORM_LABEL[platform]}
                  </span>{' '}
                  — {reason}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>

      <Card className="mt-6">
        <CardBody className="flex gap-3 text-sm text-muted">
          <Share2 size={18} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">How linked accounts get used</p>
            <p>
              <span className="text-foreground">Publishing:</span> a campaign
              post can only be published to a platform that is linked here and
              granted posting access.
            </p>
            <p>
              <span className="text-foreground">Messages:</span> collecting
              pulls DMs, comments, and mentions, matches each sender to a client
              by their handle, creates the client when the handle is new, and
              files the message in the reply queue.
            </p>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
