import type { Metadata } from 'next';
import { Share2 } from 'lucide-react';
import { getIntegrations } from '@lensello/core/integrations';
import { Card, CardBody, ErrorNote, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { listConnections } from '@/lib/connections/queries';
import { ConnectionCard } from './components/connection-card';
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

export default async function ConnectionsPage(props: PageProps<'/connections'>) {
  const { supabase } = await requireUserOrRedirect();

  // Promise in Next 16 — synchronous access was removed.
  const params = await props.searchParams;
  const linked = typeof params.linked === 'string' ? params.linked : null;
  const reason = typeof params.reason === 'string' ? params.reason : null;

  const connections = await listConnections(supabase);

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

      {mode === 'mock' ? (
        <Card className="mt-4">
          <CardBody className="space-y-2 text-sm text-muted">
            <p className="font-medium text-foreground">
              Running against the built-in simulator
            </p>
            <p>
              Linking, publishing, and message collection all work end to end,
              but they talk to Lensello&rsquo;s mock adapter rather than to
              Instagram, Facebook, TikTok, or Pinterest. Nothing here posts to a
              real account and nothing here reads a real inbox.
            </p>
            <p>
              Real accounts need approved API access from each platform — Meta
              app review for Instagram and Facebook, and the equivalent
              elsewhere. Once those credentials exist, the live adapter drops in
              behind this same screen and nothing on it changes.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {connections.map(({ platform, account }) => (
          <ConnectionCard key={platform} platform={platform} account={account} />
        ))}
      </div>

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
