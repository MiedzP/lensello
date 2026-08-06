'use client';

import { useActionState } from 'react';
import { Button, ErrorNote, Field, Input } from '@/components/ui';
import { acceptInvite } from './actions';
import { JOIN_IDLE } from './join-state';

export function JoinForm({
  token,
  lockedEmail,
}: {
  token: string;
  /** Set when the invitation names an address; the field is then fixed. */
  lockedEmail: string | null;
}) {
  const [state, action, pending] = useActionState(acceptInvite, JOIN_IDLE);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

      <Field label="Your name" htmlFor="join-name" required>
        <Input id="join-name" name="fullName" autoComplete="name" required autoFocus />
      </Field>

      <Field
        label="Email"
        htmlFor="join-email"
        required
        hint={lockedEmail ? 'This invitation is for this address.' : undefined}
      >
        <Input
          id="join-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={lockedEmail ?? ''}
          // Read-only rather than disabled: a disabled input is not submitted,
          // and the server checks the address anyway.
          readOnly={lockedEmail !== null}
        />
      </Field>

      <Field label="Choose a password" htmlFor="join-password" required hint="At least 12 characters.">
        <Input
          id="join-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Creating your account…' : 'Join the studio'}
      </Button>
    </form>
  );
}
