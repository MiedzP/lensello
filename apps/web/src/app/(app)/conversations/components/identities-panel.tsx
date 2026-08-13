'use client';

import { useActionState } from 'react';
import { BadgeCheck, Trash2, UserRoundCheck } from 'lucide-react';
import { Badge, Button, ErrorNote, Input, Select } from '@/components/ui';
import type { ContactIdentityRow } from '@/lib/conversations/queries';
import {
  addContactIdentityAction,
  removeContactIdentityAction,
  verifyContactIdentityAction,
} from '../actions';
import { INITIAL_SIMPLE } from '../form-state';

const IDENTITY_CHANNELS = [
  'email',
  'phone',
  'instagram',
  'facebook',
  'tiktok',
  'pinterest',
  'whatsapp',
] as const;

const IDENTITY_LABELS: Record<(typeof IDENTITY_CHANNELS)[number], string> = {
  email: 'Email',
  phone: 'Phone',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  whatsapp: 'WhatsApp',
};

/** Every way this person is known to reach the studio, across channels. */
export function IdentitiesPanel({
  clientId,
  identities,
}: {
  clientId: string;
  identities: ContactIdentityRow[];
}) {
  const [addState, addAction] = useActionState(addContactIdentityAction, INITIAL_SIMPLE);

  return (
    <div className="space-y-3">
      {identities.length === 0 ? (
        <p className="text-xs text-muted">No contact identities recorded yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {identities.map((identity) => (
            <IdentityRow key={identity.id} clientId={clientId} identity={identity} />
          ))}
        </ul>
      )}

      <form action={addAction} className="space-y-2" key={addState.token}>
        <input type="hidden" name="clientId" value={clientId} />
        {addState.error ? <ErrorNote>{addState.error}</ErrorNote> : null}
        {addState.message ? <p className="text-xs text-success">{addState.message}</p> : null}
        <div className="grid grid-cols-[6.5rem_1fr] gap-2">
          <Select name="channel" defaultValue="phone" className="h-8 text-xs" required>
            {IDENTITY_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {IDENTITY_LABELS[channel]}
              </option>
            ))}
          </Select>
          <Input name="identifier" placeholder="Number, address, or handle" className="h-8 text-xs" required />
        </div>
        <Button type="submit" size="sm">
          Add contact
        </Button>
      </form>
    </div>
  );
}

function IdentityRow({
  clientId,
  identity,
}: {
  clientId: string;
  identity: ContactIdentityRow;
}) {
  const [verifyState, verifyAction] = useActionState(verifyContactIdentityAction, INITIAL_SIMPLE);
  const [removeState, removeAction] = useActionState(removeContactIdentityAction, INITIAL_SIMPLE);

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-subtle px-2.5 py-1.5 text-xs">
      <div className="min-w-0">
        <span className="font-medium text-foreground">{identity.identifier}</span>
        <span className="ml-1.5 text-faint">{IDENTITY_LABELS[identity.channel as (typeof IDENTITY_CHANNELS)[number]] ?? identity.channel}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {identity.verified ? (
          <Badge tone="success">
            <BadgeCheck size={11} className="mr-1" aria-hidden="true" />
            Verified
          </Badge>
        ) : (
          <form action={verifyAction}>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="identityId" value={identity.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-full border border-subtle px-2 py-0.5 text-faint transition-colors hover:bg-surface-hover hover:text-foreground"
              title="Mark verified"
            >
              <UserRoundCheck size={11} aria-hidden="true" />
              Verify
            </button>
          </form>
        )}
        <form action={removeAction}>
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="identityId" value={identity.id} />
          <button
            type="submit"
            className="rounded-full p-1 text-faint transition-colors hover:bg-danger-subtle hover:text-danger"
            title="Remove"
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        </form>
      </div>
      {verifyState.error ? <ErrorNote>{verifyState.error}</ErrorNote> : null}
      {removeState.error ? <ErrorNote>{removeState.error}</ErrorNote> : null}
    </li>
  );
}
