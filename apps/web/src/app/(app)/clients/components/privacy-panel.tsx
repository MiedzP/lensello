'use client';

import { useActionState, useState } from 'react';
import { Download, ShieldAlert } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import { eraseClientAction, setMarketingConsentAction } from '../actions';
import { ERASE_IDLE } from '../form-state';

/**
 * Data-subject tools for one client.
 *
 * Erasure is owner-only and irreversible, so it is gated behind typing the
 * client's own name rather than a generic confirmation — that forces the
 * operator to look at which record they are actually on, which "type DELETE"
 * does not.
 */
export function PrivacyPanel({
  clientId,
  clientName,
  marketingConsent,
  isOwner,
}: {
  clientId: string;
  clientName: string;
  marketingConsent: boolean;
  isOwner: boolean;
}) {
  const [consentState, consentAction, savingConsent] = useActionState(
    setMarketingConsentAction,
    ERASE_IDLE,
  );
  const [eraseState, eraseAction, erasing] = useActionState(
    eraseClientAction,
    ERASE_IDLE,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        title="Privacy"
        description="Consent, subject access, and erasure."
      />
      <CardBody className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Marketing consent{' '}
              {marketingConsent ? (
                <Badge tone="success">Given</Badge>
              ) : (
                <Badge tone="neutral">Not given</Badge>
              )}
            </p>
            <p className="mt-0.5 max-w-prose text-xs text-muted">
              Replying to this client never needs consent. Sequences and offers
              do — without it, they are excluded from every campaign send.
            </p>
          </div>

          <form action={consentAction}>
            <input type="hidden" name="clientId" value={clientId} />
            <input
              type="hidden"
              name="granted"
              value={marketingConsent ? 'false' : 'true'}
            />
            <Button type="submit" disabled={savingConsent}>
              {savingConsent
                ? 'Saving…'
                : marketingConsent
                  ? 'Record withdrawal'
                  : 'Record consent'}
            </Button>
          </form>
        </div>

        {consentState.message ? (
          <p role="status" aria-live="polite" className="text-xs text-muted">
            {consentState.message}
          </p>
        ) : null}
        {consentState.error ? (
          <p role="status" aria-live="polite" className="text-xs text-danger">
            {consentState.error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-5">
          <div>
            <p className="text-sm font-medium text-foreground">Subject access</p>
            <p className="mt-0.5 max-w-prose text-xs text-muted">
              Downloads everything held about this client as JSON, including
              messages, consents, gigs and shoots.
            </p>
          </div>

          {/* A plain link, not an action: the useful outcome is a file. */}
          <a
            href={`/clients/${clientId}/export`}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-strong bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            <Download size={14} aria-hidden="true" />
            Export
          </a>
        </div>

        {isOwner ? (
          <div className="border-t border-subtle pt-5">
            <p className="flex items-center gap-2 text-sm font-medium text-danger">
              <ShieldAlert size={15} aria-hidden="true" />
              Erase this client
            </p>
            <p className="mt-1 max-w-prose text-xs text-muted">
              Deletes the client record, every message, their social handles and
              their consent history. Gigs and shoots are <em>kept</em> with the
              personal link removed — those are the studio&rsquo;s own business
              records. Names typed by hand into a gig title or a shoot note are
              not touched and need a human to review.
            </p>

            {eraseState.error ? (
              <p role="status" aria-live="polite" className="mt-2 text-xs text-danger">
                {eraseState.error}
              </p>
            ) : null}

            {confirmOpen ? (
              <form action={eraseAction} className="mt-3 space-y-2">
                <input type="hidden" name="clientId" value={clientId} />
                <label
                  htmlFor="erase-confirmation"
                  className="block text-xs text-muted"
                >
                  Type <span className="font-medium text-foreground">{clientName}</span>{' '}
                  to confirm.
                </label>
                <Input
                  id="erase-confirmation"
                  name="confirmation"
                  autoComplete="off"
                  className="max-w-xs"
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={erasing}>
                    {erasing ? 'Erasing…' : 'Erase permanently'}
                  </Button>
                  <Button type="button" onClick={() => setConfirmOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                className="mt-3"
                onClick={() => setConfirmOpen(true)}
              >
                Erase client data
              </Button>
            )}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
