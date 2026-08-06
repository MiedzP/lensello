'use client';

import { useActionState } from 'react';
import { Link2, Unlink } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardFooter } from '@/components/ui';
import { IDLE, type ActionState } from '@/lib/connections/action-state';
import type { SocialAccountRow } from '@/lib/connections/queries';
import { disconnect, startConnection } from '../actions';
import { SyncMessagesForm } from './sync-messages-form';

const PLATFORM_LABEL: Record<SocialAccountRow['platform'], string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
};

/** Platforms with no messaging product at all, so the card can say why. */
const NO_MESSAGING: ReadonlySet<string> = new Set(['pinterest']);

function formatFollowers(count: number): string {
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'never';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function ConnectionCard({
  platform,
  account,
}: {
  platform: SocialAccountRow['platform'];
  account: SocialAccountRow | null;
}) {
  const [connectState, connectAction, connecting] = useActionState(
    startConnection,
    IDLE,
  );
  const [disconnectState, disconnectAction, disconnecting] = useActionState(
    disconnect,
    IDLE,
  );

  const label = PLATFORM_LABEL[platform];
  const isLinked = account !== null && account.status === 'connected';
  const isExpired = account !== null && account.status !== 'connected';

  const problem: ActionState['error'] =
    connectState.error ?? disconnectState.error ?? null;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{label}</h2>
            <p className="mt-0.5 truncate text-sm text-muted">
              {account ? `@${account.handle}` : 'Not linked'}
            </p>
          </div>

          {isLinked ? (
            <Badge tone="success">Connected</Badge>
          ) : isExpired ? (
            <Badge tone="warning">
              {account.status === 'expired' ? 'Token expired' : 'Revoked'}
            </Badge>
          ) : (
            <Badge tone="neutral">Not linked</Badge>
          )}
        </div>

        {account ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-faint">Followers</dt>
              <dd className="mt-0.5 text-foreground">
                {formatFollowers(account.followers)}
              </dd>
            </div>
            <div>
              <dt className="text-faint">Last synced</dt>
              <dd className="mt-0.5 text-foreground">
                {formatWhen(account.last_synced_at)}
              </dd>
            </div>
          </dl>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {account?.can_publish ? (
            <Badge tone="accent">Publishes posts</Badge>
          ) : null}
          {account?.can_collect_messages ? (
            <Badge tone="accent">Collects messages</Badge>
          ) : null}
          {account && !account.can_collect_messages && NO_MESSAGING.has(platform) ? (
            <Badge tone="neutral">No messaging API</Badge>
          ) : null}
        </div>

        {account?.last_error ? (
          <p role="status" className="text-xs text-danger">
            {account.last_error}
          </p>
        ) : null}

        {problem ? (
          <p role="status" aria-live="polite" className="text-xs text-danger">
            {problem}
          </p>
        ) : null}

        {disconnectState.message ? (
          <p role="status" aria-live="polite" className="text-xs text-muted">
            {disconnectState.message}
          </p>
        ) : null}
      </CardBody>

      <CardFooter>
        {isLinked && account.can_collect_messages ? (
          <SyncMessagesForm platform={platform} label="Collect" />
        ) : null}

        {account ? (
          <>
            {/* Re-linking is how an expired token is replaced, so the connect
                form stays available on a linked card. */}
            <form action={connectAction}>
              <input type="hidden" name="platform" value={platform} />
              <Button type="submit" disabled={connecting || disconnecting}>
                <Link2 size={14} aria-hidden="true" />
                {connecting ? 'Opening…' : 'Reconnect'}
              </Button>
            </form>

            <form action={disconnectAction}>
              <input type="hidden" name="platform" value={platform} />
              <Button type="submit" disabled={connecting || disconnecting}>
                <Unlink size={14} aria-hidden="true" />
                {disconnecting ? 'Unlinking…' : 'Unlink'}
              </Button>
            </form>
          </>
        ) : (
          <form action={connectAction}>
            <input type="hidden" name="platform" value={platform} />
            <Button type="submit" variant="primary" disabled={connecting}>
              <Link2 size={14} aria-hidden="true" />
              {connecting ? 'Opening…' : `Connect ${label}`}
            </Button>
          </form>
        )}
      </CardFooter>
    </Card>
  );
}
