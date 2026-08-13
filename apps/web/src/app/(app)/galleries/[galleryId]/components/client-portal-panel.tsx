'use client';

import { useActionState, useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader, ErrorNote, Field, Input, Select } from '@/components/ui';
import { linkClient, revokePortalAccess, sendPortalInvite } from '../actions';
import { GALLERY_ADMIN_IDLE } from '../admin-state';

export interface ClientOption {
  id: string;
  name: string;
}

export interface PortalAccountView {
  id: string;
  email: string;
  hasPasscode: boolean;
  revokedAt: string | null;
  lastSeenAt: string | null;
}

/**
 * Links a gallery to a client record and manages that client's portal
 * sign-in. Separate concerns bolted together in one card because a
 * photographer thinks of them as one step: "does this person's account see
 * this gallery, and can they get in".
 */
export function ClientPortalPanel({
  galleryId,
  clientId,
  clientEmail,
  clients,
  portalAccount,
}: {
  galleryId: string;
  clientId: string | null;
  clientEmail: string | null;
  clients: ClientOption[];
  portalAccount: PortalAccountView | null;
}) {
  const [linkState, linkAction, linking] = useActionState(linkClient, GALLERY_ADMIN_IDLE);

  return (
    <Card>
      <CardHeader
        title="Client & portal"
        description="Link this gallery to a client so it appears in their portal, and manage their sign-in."
      />
      <CardBody className="space-y-5">
        {linkState.error ? <ErrorNote>{linkState.error}</ErrorNote> : null}
        {linkState.message ? (
          <p role="status" className="text-sm text-success">
            {linkState.message}
          </p>
        ) : null}

        <form action={linkAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="galleryId" value={galleryId} />
          <Field label="Client" htmlFor="clientId" className="min-w-48 flex-1">
            <Select id="clientId" name="clientId" defaultValue={clientId ?? ''}>
              <option value="">No client linked</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" disabled={linking}>
            {linking ? 'Saving…' : 'Save'}
          </Button>
        </form>

        {clientId ? (
          <PortalAccountStatus
            galleryId={galleryId}
            clientId={clientId}
            defaultEmail={clientEmail ?? ''}
            portalAccount={portalAccount}
          />
        ) : (
          <p className="text-sm text-muted">Link a client above to invite them to the portal.</p>
        )}
      </CardBody>
    </Card>
  );
}

function PortalAccountStatus({
  galleryId,
  clientId,
  defaultEmail,
  portalAccount,
}: {
  galleryId: string;
  clientId: string;
  defaultEmail: string;
  portalAccount: PortalAccountView | null;
}) {
  const [inviteState, inviteAction, inviting] = useActionState(sendPortalInvite, GALLERY_ADMIN_IDLE);
  const [revokeState, revokeAction, revoking] = useActionState(revokePortalAccess, GALLERY_ADMIN_IDLE);
  const [email, setEmail] = useState(portalAccount?.email ?? defaultEmail);

  return (
    <div className="rounded-md border border-subtle p-4">
      {inviteState.error ? <ErrorNote>{inviteState.error}</ErrorNote> : null}
      {inviteState.message ? (
        <p role="status" className="mb-3 text-sm text-success">
          {inviteState.message}
        </p>
      ) : null}
      {revokeState.error ? <ErrorNote>{revokeState.error}</ErrorNote> : null}
      {revokeState.message ? (
        <p role="status" className="mb-3 text-sm text-success">
          {revokeState.message}
        </p>
      ) : null}

      {portalAccount ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-foreground">{portalAccount.email}</span>
          {portalAccount.revokedAt ? (
            <Badge tone="neutral">Revoked</Badge>
          ) : portalAccount.hasPasscode ? (
            <Badge tone="success">Active</Badge>
          ) : (
            <Badge tone="warning">Invited, not set up</Badge>
          )}
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted">This client has no portal account yet.</p>
      )}

      <form action={inviteAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="galleryId" value={galleryId} />
        <input type="hidden" name="clientId" value={clientId} />
        <Field label="Email" htmlFor="portal-email" className="min-w-48 flex-1">
          <Input
            id="portal-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Button type="submit" variant="primary" disabled={inviting}>
          {inviting ? 'Sending…' : portalAccount?.hasPasscode ? 'Resend / reset passcode' : 'Send invite'}
        </Button>
      </form>

      {portalAccount && !portalAccount.revokedAt ? (
        <form action={revokeAction} className="mt-3">
          <input type="hidden" name="galleryId" value={galleryId} />
          <input type="hidden" name="accountId" value={portalAccount.id} />
          <Button type="submit" variant="danger" size="sm" disabled={revoking}>
            {revoking ? 'Revoking…' : 'Revoke portal access'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
