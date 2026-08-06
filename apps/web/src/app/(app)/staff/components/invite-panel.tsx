'use client';

import { useActionState, useState } from 'react';
import { Check, Copy, Mail, UserPlus, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorNote,
  Field,
  Input,
} from '@/components/ui';
import { INVITE_IDLE, createInvite, revokeInvite } from '../invite-actions';

export interface InviteRowView {
  id: string;
  email: string | null;
  note: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

function when(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function InviteLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === 'undefined' ? path : `${window.location.origin}${path}`;

  return (
    <div className="rounded-md border border-success/30 bg-success-subtle p-3">
      <p className="text-xs font-medium text-success">
        Send this to them. It is not stored and cannot be shown again.
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

export function InvitePanel({ invites }: { invites: InviteRowView[] }) {
  const [createState, createAction, creating] = useActionState(createInvite, INVITE_IDLE);
  const [revokeState, revokeAction, revoking] = useActionState(revokeInvite, INVITE_IDLE);
  const [showForm, setShowForm] = useState(false);

  const pending = invites.filter(
    (invite) => !invite.acceptedAt && !invite.revokedAt,
  );

  return (
    <Card className="mt-6">
      <CardHeader
        title="Invitations"
        description="Send someone a link that sets up their account. No code for them to type."
        action={
          <Button type="button" onClick={() => setShowForm((open) => !open)}>
            <UserPlus size={14} aria-hidden="true" />
            {showForm ? 'Cancel' : 'Invite someone'}
          </Button>
        }
      />

      <CardBody className="space-y-4">
        {createState.error ? <ErrorNote>{createState.error}</ErrorNote> : null}
        {revokeState.error ? <ErrorNote>{revokeState.error}</ErrorNote> : null}
        {revokeState.message ? (
          <p role="status" className="text-sm text-muted">
            {revokeState.message}
          </p>
        ) : null}

        {createState.inviteUrl ? <InviteLink path={createState.inviteUrl} /> : null}

        {showForm ? (
          <form action={createAction} className="space-y-4 rounded-md border border-subtle p-4">
            <Field
              label="Their email"
              htmlFor="invite-email"
              hint="Optional. If you set it, the link only works for that address — so a forwarded link is useless to anyone else."
            >
              <Input id="invite-email" name="email" type="email" placeholder="sam@example.com" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Note" htmlFor="invite-note" hint="Shown on the join page.">
                <Input id="invite-note" name="note" placeholder="Second shooter for the autumn season" />
              </Field>

              <Field label="Expires after" htmlFor="invite-expiry" hint="Days. Defaults to 14.">
                <Input id="invite-expiry" name="expiresInDays" inputMode="numeric" placeholder="14" />
              </Field>
            </div>

            <p className="text-xs text-muted">
              Invitations always create a <span className="text-foreground">staff</span>{' '}
              account. Making somebody an owner is a deliberate change in the
              database, not something a link can grant.
            </p>

            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create invitation'}
            </Button>
          </form>
        ) : null}

        {invites.length === 0 ? (
          <p className="text-sm text-muted">
            No invitations yet. Create one and send the link — they set their own
            password and land straight in the app.
          </p>
        ) : (
          <ul className="divide-y divide-subtle">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    <Mail size={13} aria-hidden="true" className="text-faint" />
                    {invite.email ?? 'Open link'}
                    {invite.acceptedAt ? (
                      <Badge tone="success">Joined</Badge>
                    ) : invite.revokedAt ? (
                      <Badge tone="neutral">Withdrawn</Badge>
                    ) : (
                      <Badge tone="accent">Waiting</Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {invite.acceptedAt
                      ? `Joined ${when(invite.acceptedAt)}`
                      : `Sent ${when(invite.createdAt)}${
                          invite.expiresAt ? ` · expires ${when(invite.expiresAt)}` : ''
                        }`}
                    {invite.note ? ` · ${invite.note}` : ''}
                  </p>
                </div>

                {!invite.acceptedAt && !invite.revokedAt ? (
                  <form action={revokeAction}>
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <Button type="submit" disabled={revoking}>
                      <X size={14} aria-hidden="true" />
                      Withdraw
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {pending.length > 0 ? (
          <p className="text-xs text-faint">
            {pending.length} invitation{pending.length === 1 ? '' : 's'} outstanding.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
