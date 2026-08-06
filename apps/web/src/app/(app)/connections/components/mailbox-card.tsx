'use client';

import { useActionState, useState } from 'react';
import { Mail, Plug, Unlink } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  Field,
  Input,
} from '@/components/ui';
import { IDLE } from '@/lib/connections/action-state';
import { connectMailbox, disconnectMailbox } from '../actions';

export interface MailboxView {
  id: string;
  emailAddress: string;
  displayName: string;
  imapHost: string;
  smtpHost: string;
  status: 'connected' | 'failing' | 'disabled';
  lastError: string | null;
  lastSyncedLabel: string;
}

/** Where each provider hides app passwords, so nobody has to go hunting. */
const APP_PASSWORD_HELP: Array<{ match: RegExp; label: string; url: string }> = [
  { match: /@(gmail|googlemail)\.com$/i, label: 'Google app passwords', url: 'https://myaccount.google.com/apppasswords' },
  { match: /@(outlook|hotmail|live)\.com$/i, label: 'Microsoft app passwords', url: 'https://account.microsoft.com/security' },
  { match: /@(icloud|me)\.com$/i, label: 'Apple app-specific passwords', url: 'https://account.apple.com' },
  { match: /@yahoo\.com$/i, label: 'Yahoo app passwords', url: 'https://login.yahoo.com/account/security' },
];

export function MailboxCard({
  mailbox,
  encryptionReady,
}: {
  mailbox: MailboxView | null;
  encryptionReady: boolean;
}) {
  const [connectState, connectAction, connecting] = useActionState(
    connectMailbox,
    IDLE,
  );
  const [disconnectState, disconnectAction, disconnecting] = useActionState(
    disconnectMailbox,
    IDLE,
  );

  const [address, setAddress] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const help = APP_PASSWORD_HELP.find((entry) => entry.match.test(address));

  if (mailbox) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Mail size={15} aria-hidden="true" />
                Studio mailbox
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted">
                {mailbox.emailAddress}
              </p>
            </div>
            {mailbox.status === 'connected' ? (
              <Badge tone="success">Connected</Badge>
            ) : (
              <Badge tone="warning">
                {mailbox.status === 'failing' ? 'Failing' : 'Disabled'}
              </Badge>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-faint">Servers</dt>
              <dd className="mt-0.5 truncate text-foreground">
                {mailbox.imapHost} / {mailbox.smtpHost}
              </dd>
            </div>
            <div>
              <dt className="text-faint">Last synced</dt>
              <dd className="mt-0.5 text-foreground">{mailbox.lastSyncedLabel}</dd>
            </div>
          </dl>

          <p className="text-xs text-muted">
            Client replies send from this address, so they thread in the
            client&rsquo;s mail app and answers come back to your inbox.
          </p>

          {mailbox.lastError ? (
            <p role="status" className="text-xs text-danger">
              {mailbox.lastError}
            </p>
          ) : null}

          {disconnectState.error ? (
            <p role="status" aria-live="polite" className="text-xs text-danger">
              {disconnectState.error}
            </p>
          ) : null}
        </CardBody>

        <CardFooter>
          <form action={disconnectAction}>
            <input type="hidden" name="mailboxId" value={mailbox.id} />
            <Button type="submit" disabled={disconnecting}>
              <Unlink size={14} aria-hidden="true" />
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </form>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <form action={connectAction}>
        <CardBody className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Mail size={15} aria-hidden="true" />
              Studio mailbox
            </h2>
            <p className="mt-1 text-sm text-muted">
              Connect the address clients already write to. Lensello reads new
              enquiries from it and sends your replies as you.
            </p>
          </div>

          {!encryptionReady ? (
            <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning">
              <code>LENSELLO_ENCRYPTION_KEY</code> is not set on this
              deployment, so a password cannot be stored safely. Connecting is
              disabled until it is.
            </p>
          ) : null}

          {connectState.error ? (
            <p role="status" aria-live="polite" className="text-xs text-danger">
              {connectState.error}
            </p>
          ) : null}

          <Field label="Email address" htmlFor="mailbox-address" required>
            <Input
              id="mailbox-address"
              name="emailAddress"
              type="email"
              autoComplete="email"
              placeholder="hello@yourstudio.com"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
            />
          </Field>

          <Field
            label="Display name"
            htmlFor="mailbox-name"
            hint="Shown as the sender. Optional."
          >
            <Input
              id="mailbox-name"
              name="displayName"
              placeholder="Lensello Photography"
              autoComplete="off"
            />
          </Field>

          <Field
            label="App password"
            htmlFor="mailbox-password"
            required
            hint={
              help ? (
                <>
                  Not your normal password — generate one at{' '}
                  <a
                    href={help.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent hover:underline"
                  >
                    {help.label}
                  </a>
                  . Two-factor authentication must be on.
                </>
              ) : (
                'Not your normal password. Most providers call this an app password, and require two-factor authentication first.'
              )
            }
          >
            <Input
              id="mailbox-password"
              name="password"
              type="password"
              autoComplete="off"
              required
            />
          </Field>

          <button
            type="button"
            onClick={() => setShowAdvanced((open) => !open)}
            className="text-xs text-accent hover:underline"
          >
            {showAdvanced ? 'Hide server settings' : 'Server settings'}
          </button>

          {showAdvanced ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="IMAP host" htmlFor="mailbox-imap-host">
                <Input id="mailbox-imap-host" name="imapHost" placeholder="imap.gmail.com" />
              </Field>
              <Field label="IMAP port" htmlFor="mailbox-imap-port">
                <Input id="mailbox-imap-port" name="imapPort" inputMode="numeric" placeholder="993" />
              </Field>
              <Field label="SMTP host" htmlFor="mailbox-smtp-host">
                <Input id="mailbox-smtp-host" name="smtpHost" placeholder="smtp.gmail.com" />
              </Field>
              <Field label="SMTP port" htmlFor="mailbox-smtp-port">
                <Input id="mailbox-smtp-port" name="smtpPort" inputMode="numeric" placeholder="465" />
              </Field>
              <p className="text-xs text-muted sm:col-span-2">
                Leave blank for Gmail, Outlook, iCloud, Yahoo, Zoho, and
                Fastmail — those are filled in automatically.
              </p>
            </div>
          ) : null}
        </CardBody>

        <CardFooter>
          <Button
            type="submit"
            variant="primary"
            disabled={connecting || !encryptionReady}
          >
            <Plug size={14} aria-hidden="true" />
            {connecting ? 'Testing and connecting…' : 'Connect mailbox'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
