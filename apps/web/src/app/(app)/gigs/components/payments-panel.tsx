'use client';

import { useActionState } from 'react';
import { ExternalLink } from 'lucide-react';
import { formatCents } from '@lensello/core';
import { Badge, Button, Card, CardBody, CardHeader, ErrorNote } from '@/components/ui';
import {
  EMPTY_PAYMENT_STATE,
  type PaymentActionState,
  type PaymentKind,
} from '@/lib/gigs/action-state';
import { checkGigPayment, requestGigPayment } from '../actions';

interface PaymentsPanelProps {
  gigId: string;
  priceCents: number;
  depositCents: number;
  outstandingCents: number;
  depositPaidAt: string | null;
  balancePaidAt: string | null;
  /**
   * Pre-formatted on the server. Formatting a date inside a Client Component
   * renders one string during SSR and possibly another after hydration, because
   * the two run in different locales and timezones.
   */
  depositPaidLabel: string | null;
  balancePaidLabel: string | null;
  depositUrl: string | null;
  balanceUrl: string | null;
  depositRequested: boolean;
  balanceRequested: boolean;
}

/**
 * Deposit and balance collection.
 *
 * Both go through `getIntegrations().payments` — there is no Stripe call
 * anywhere in this module. The hosted checkout URL is stored when the request is
 * created, so the photographer can still copy the link days later; "Check
 * payment status" asks the provider and only then stamps `deposit_paid_at` /
 * `balance_paid_at`. Pressing the button never marks something paid by itself.
 */
export function PaymentsPanel(props: PaymentsPanelProps) {
  const [requestState, requestAction, requesting] = useActionState(
    requestGigPayment,
    EMPTY_PAYMENT_STATE,
  );
  const [checkState, checkAction, checking] = useActionState(
    checkGigPayment,
    EMPTY_PAYMENT_STATE,
  );

  const depositSettled = Boolean(props.depositPaidAt);
  const balanceSettled = Boolean(props.balancePaidAt);
  const balanceUnlocked = depositSettled || props.depositCents === 0;

  return (
    <Card>
      <CardHeader
        title="Payments"
        description={`${formatCents(props.priceCents)} total`}
        action={
          <Badge tone={balanceSettled ? 'success' : depositSettled ? 'accent' : 'warning'}>
            {balanceSettled
              ? 'Paid in full'
              : depositSettled
                ? `${formatCents(props.outstandingCents)} outstanding`
                : 'Awaiting deposit'}
          </Badge>
        }
      />

      <CardBody className="space-y-5">
        <PaymentRow
          kind="deposit"
          gigId={props.gigId}
          title="Deposit"
          amountCents={props.depositCents}
          paidAt={props.depositPaidAt}
          paidLabel={props.depositPaidLabel}
          savedUrl={props.depositUrl}
          requested={props.depositRequested}
          disabledReason={
            props.depositCents === 0
              ? 'No deposit is set on this gig. Edit the gig to add one.'
              : null
          }
          requestState={requestState}
          checkState={checkState}
          requestAction={requestAction}
          checkAction={checkAction}
          requesting={requesting}
          checking={checking}
        />

        <div className="border-t border-subtle pt-5">
          <PaymentRow
            kind="balance"
            gigId={props.gigId}
            title="Balance"
            amountCents={props.outstandingCents}
            paidAt={props.balancePaidAt}
            paidLabel={props.balancePaidLabel}
            savedUrl={props.balanceUrl}
            requested={props.balanceRequested}
            disabledReason={
              props.outstandingCents === 0
                ? 'The deposit covers the whole price, so there is no balance.'
                : !balanceUnlocked
                  ? 'Collect the deposit first.'
                  : null
            }
            requestState={requestState}
            checkState={checkState}
            requestAction={requestAction}
            checkAction={checkAction}
            requesting={requesting}
            checking={checking}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function PaymentRow({
  kind,
  gigId,
  title,
  amountCents,
  paidAt,
  paidLabel,
  savedUrl,
  requested,
  disabledReason,
  requestState,
  checkState,
  requestAction,
  checkAction,
  requesting,
  checking,
}: {
  kind: PaymentKind;
  gigId: string;
  title: string;
  amountCents: number;
  paidAt: string | null;
  paidLabel: string | null;
  savedUrl: string | null;
  requested: boolean;
  disabledReason: string | null;
  requestState: PaymentActionState;
  checkState: PaymentActionState;
  requestAction: (formData: FormData) => void;
  checkAction: (formData: FormData) => void;
  requesting: boolean;
  checking: boolean;
}) {
  const settled = Boolean(paidAt);
  // Both action states are shared across the two rows; only show the message on
  // the row it belongs to.
  const request = requestState.kind === kind ? requestState : null;
  const check = checkState.kind === kind ? checkState : null;
  const url = request?.url ?? check?.url ?? savedUrl;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">
          {title}{' '}
          <span className="tabular-nums text-muted">{formatCents(amountCents)}</span>
        </h3>
        <Badge tone={settled ? 'success' : requested ? 'accent' : 'neutral'}>
          {settled ? 'Paid' : requested ? 'Requested' : 'Not requested'}
        </Badge>
      </div>

      {request?.phase === 'error' && request.message ? (
        <ErrorNote>{request.message}</ErrorNote>
      ) : null}
      {check?.phase === 'error' && check.message ? (
        <ErrorNote>{check.message}</ErrorNote>
      ) : null}

      {request?.phase === 'done' && request.message ? (
        <p role="status" className="text-sm text-success">
          {request.message}
        </p>
      ) : null}
      {check?.phase === 'done' && check.message ? (
        <p role="status" className="text-sm text-muted">
          {check.message}
        </p>
      ) : null}

      {url && !settled ? (
        <div className="rounded-md border border-subtle bg-surface-raised px-3 py-2">
          <p className="text-xs font-medium text-muted">Hosted checkout link</p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-0.5 inline-flex items-center gap-1.5 text-sm break-all text-accent underline underline-offset-2"
          >
            {url}
            <ExternalLink size={13} aria-hidden="true" className="shrink-0" />
          </a>
          <p className="mt-1 text-xs text-faint">
            Send this to the client. Nothing is charged until they complete it.
          </p>
        </div>
      ) : null}

      {paidAt ? (
        <p className="text-sm text-muted">
          Recorded as paid on <time dateTime={paidAt}>{paidLabel ?? paidAt}</time>.
        </p>
      ) : disabledReason ? (
        <p className="text-sm text-muted">{disabledReason}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <form action={requestAction}>
            <input type="hidden" name="gigId" value={gigId} />
            <input type="hidden" name="kind" value={kind} />
            <Button type="submit" size="sm" variant="primary" disabled={requesting}>
              {requesting
                ? 'Creating link…'
                : requested
                  ? `New ${kind} link`
                  : `Request ${kind}`}
            </Button>
          </form>

          {requested ? (
            <form action={checkAction}>
              <input type="hidden" name="gigId" value={gigId} />
              <input type="hidden" name="kind" value={kind} />
              <Button type="submit" size="sm" disabled={checking}>
                {checking ? 'Checking…' : 'Check payment status'}
              </Button>
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
}
