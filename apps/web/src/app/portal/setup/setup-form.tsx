'use client';

import { useActionState } from 'react';
import { Button, ErrorNote, Field, Input } from '@/components/ui';
import { PORTAL_IDLE } from '../portal-state';
import { submitPasscode } from './actions';

export function SetupForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(submitPasscode, PORTAL_IDLE);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <p className="text-center text-sm text-muted">
        Signing in as <span className="font-medium text-foreground">{email}</span>
      </p>

      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

      <Field label="Choose a passcode" htmlFor="passcode" required hint="At least 6 characters.">
        <Input id="passcode" name="passcode" type="password" autoComplete="new-password" required autoFocus />
      </Field>

      <Field label="Confirm passcode" htmlFor="confirm" required>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Save and sign in'}
      </Button>
    </form>
  );
}
