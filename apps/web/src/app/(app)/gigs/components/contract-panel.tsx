'use client';

import { useActionState, useState } from 'react';
import { Check, Copy, FileText, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorNote,
  Field,
  Input,
  Textarea,
} from '@/components/ui';
import { draftContract, sendContract, voidContract } from '../contract-actions';
import { CONTRACT_ADMIN_IDLE } from '../contract-state';

export interface ContractRowView {
  id: string;
  title: string;
  status: 'draft' | 'sent' | 'accepted' | 'void';
  sentAt: string | null;
  acceptedAt: string | null;
  acceptedName: string | null;
  expiresAt: string | null;
}

const STATUS_TONE = {
  draft: 'neutral',
  sent: 'accent',
  accepted: 'success',
  void: 'neutral',
} as const;

function when(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ShareLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === 'undefined' ? path : `${window.location.origin}${path}`;

  return (
    <div className="rounded-md border border-success/30 bg-success-subtle p-3">
      <p className="text-xs font-medium text-success">
        Send this to the client. It is not stored and cannot be shown again.
      </p>
      <div className="mt-2 flex gap-2">
        <Input readOnly value={url} onFocus={(event) => event.target.select()} />
        <Button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => setCopied(true));
          }}
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

export function ContractPanel({
  gigId,
  contracts,
}: {
  gigId: string;
  contracts: ContractRowView[];
}) {
  const [draftState, draftAction, drafting] = useActionState(
    draftContract,
    CONTRACT_ADMIN_IDLE,
  );
  const [sendState, sendAction, sending] = useActionState(
    sendContract,
    CONTRACT_ADMIN_IDLE,
  );
  const [voidState, voidAction, voiding] = useActionState(
    voidContract,
    CONTRACT_ADMIN_IDLE,
  );

  const draft = sendState.draft ?? draftState.draft;

  return (
    <Card className="mt-6">
      <CardHeader
        title="Agreement"
        description="Send the client terms to accept online. Their typed name, the date, and the exact wording are recorded together."
        action={
          draft ? null : (
            <form action={draftAction}>
              <input type="hidden" name="gigId" value={gigId} />
              <Button type="submit" disabled={drafting}>
                <FileText size={14} aria-hidden="true" />
                {drafting ? 'Preparing…' : 'Draft agreement'}
              </Button>
            </form>
          )
        }
      />

      <CardBody className="space-y-4">
        {draftState.error ? <ErrorNote>{draftState.error}</ErrorNote> : null}
        {sendState.error ? <ErrorNote>{sendState.error}</ErrorNote> : null}
        {voidState.error ? <ErrorNote>{voidState.error}</ErrorNote> : null}

        {voidState.message ? (
          <p role="status" className="text-sm text-muted">
            {voidState.message}
          </p>
        ) : null}

        {sendState.shareUrl ? <ShareLink path={sendState.shareUrl} /> : null}

        {draft ? (
          <form action={sendAction} className="space-y-4">
            <input type="hidden" name="gigId" value={gigId} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="contract-title">
                <Input
                  id="contract-title"
                  name="title"
                  defaultValue="Photography agreement"
                />
              </Field>
              <Field
                label="Expires after"
                htmlFor="contract-expiry"
                hint="Days. Blank means no expiry."
              >
                <Input id="contract-expiry" name="expiresInDays" inputMode="numeric" placeholder="30" />
              </Field>
            </div>

            <Field
              label="Terms"
              htmlFor="contract-body"
              hint="Read this through and edit it to match how you actually work. It is a starting point, not legal advice."
            >
              <Textarea
                id="contract-body"
                name="body"
                rows={18}
                defaultValue={draft}
                className="font-mono text-xs"
              />
            </Field>

            <p className="text-xs text-muted">
              Whatever is in this box when you send becomes a permanent snapshot.
              Editing your standard terms later will not change an agreement
              already sent or accepted.
            </p>

            <Button type="submit" variant="primary" disabled={sending}>
              {sending ? 'Preparing link…' : 'Send for signing'}
            </Button>
          </form>
        ) : null}

        {contracts.length === 0 ? (
          <p className="text-sm text-muted">
            No agreement sent for this gig yet.
          </p>
        ) : (
          <ul className="divide-y divide-subtle">
            {contracts.map((contract) => (
              <li
                key={contract.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {contract.title}
                    <Badge tone={STATUS_TONE[contract.status]}>{contract.status}</Badge>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {contract.status === 'accepted' && contract.acceptedName
                      ? `Signed by ${contract.acceptedName} on ${when(contract.acceptedAt)}`
                      : `Sent ${when(contract.sentAt)}${
                          contract.expiresAt ? ` · expires ${when(contract.expiresAt)}` : ''
                        }`}
                  </p>
                </div>

                {contract.status === 'sent' ? (
                  <form action={voidAction}>
                    <input type="hidden" name="contractId" value={contract.id} />
                    <Button type="submit" disabled={voiding}>
                      <X size={14} aria-hidden="true" />
                      Withdraw
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
