'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink, HardDrive } from 'lucide-react';
import { Badge, Button, Card, CardBody } from '@/components/ui';

/**
 * Explains the one unusual step — sharing a folder with a robot address — the
 * same way `connections/components/calendar-card.tsx` explains it for the
 * calendar. Written so it stands on its own even for a studio that has
 * already connected the calendar: the account and the reasoning are the
 * same, but sharing a *Drive folder* is a different click than sharing a
 * *calendar*, and skipping that explanation would leave someone looking for
 * a "connect Drive" button that deliberately does not exist.
 */
export function DriveStatusCard({
  status,
  serviceAccount,
}: {
  status: 'live' | 'mock' | 'unavailable';
  serviceAccount: string | null;
}) {
  const [open, setOpen] = useState(false);
  const connected = status === 'live';

  return (
    <Card className="mb-6">
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-2.5">
            <HardDrive size={18} className="mt-0.5 shrink-0 text-faint" aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Google Drive</h3>
              <p className="mt-0.5 text-sm text-muted">
                {connected
                  ? 'Reading folders shared with the service account.'
                  : 'Not connected'}
              </p>
            </div>
          </div>

          {connected ? (
            <Badge tone="success">Connected</Badge>
          ) : status === 'mock' ? (
            <Badge tone="warning">Simulated</Badge>
          ) : (
            <Badge tone="danger">Unavailable</Badge>
          )}
        </div>

        {connected ? (
          serviceAccount ? (
            <p className="text-xs text-faint">
              Reading as {serviceAccount}. To add a folder, share it with that
              address in Google Drive. To remove access, unshare it there — it
              takes effect immediately.
            </p>
          ) : null
        ) : status === 'mock' ? (
          <p className="rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning">
            The folders below are invented fixtures, not your studio&rsquo;s
            Drive. Importing from them still exercises the real pipeline —
            photos, tags and a shoot really are created — so it is safe to try
            end to end before Drive is connected.
          </p>
        ) : (
          <p className="rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-xs text-danger">
            Drive import is unavailable until it is configured. Nothing can be
            imported until the steps below are done.
          </p>
        )}

        <Button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
          />
          {open ? 'Hide setup steps' : connected ? 'Setup steps' : 'How to connect it'}
        </Button>

        {open ? (
          <div className="space-y-4 rounded-md border border-subtle bg-surface-raised p-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Why you share a folder instead of signing in
              </p>
              <p className="mt-1 text-xs text-muted">
                Same reasoning as the studio calendar: an app that has not been
                through Google&rsquo;s review has its sign-in expire every
                seven days for a sensitive scope like Drive. A service account
                does not expire — you share a folder with its email address,
                the same way you would share it with an assistant, and it can
                then see exactly that folder and nothing else in your Drive.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">
                If the studio calendar is already connected
              </p>
              <p className="mt-1 text-xs text-muted">
                Use the same service account — nothing new to create. In
                Google Cloud, open that project and turn on the{' '}
                <span className="font-medium text-foreground">Google Drive API</span>{' '}
                (APIs &amp; Services → Library → search &ldquo;Google Drive
                API&rdquo; → Enable). Then in Google Drive, right-click a
                folder of in-house or personal photos → Share → paste the
                service account&rsquo;s email (ending{' '}
                <code className="rounded bg-surface px-1 py-0.5">
                  …iam.gserviceaccount.com
                </code>
                ) → Viewer is enough, this only ever reads.
              </p>
              <p className="mt-2 text-xs text-muted">
                Starting from nothing: follow &ldquo;How to connect it&rdquo;
                on the{' '}
                <a href="/connections" className="text-accent hover:underline">
                  Connections
                </a>{' '}
                page first — it creates the service account and its key — then
                come back and share a folder with it as above.
              </p>
              <div className="mt-3">
                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  Open Google Drive
                  <ExternalLink size={11} aria-hidden="true" />
                </a>
              </div>
            </div>

            {!connected ? (
              <p className="border-t border-subtle pt-4 text-xs text-muted">
                <span className="text-foreground">How you will know it worked:</span>{' '}
                reload this page — the amber or red note above becomes a green
                &ldquo;Connected&rdquo;, and the folder you shared appears in
                the list below.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
