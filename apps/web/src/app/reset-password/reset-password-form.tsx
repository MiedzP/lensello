'use client';

import { useActionState } from 'react';
import { Button, Field, Input, ErrorNote } from '@/components/ui';
import { resetPassword, type ResetPasswordState } from './actions';

const INITIAL: ResetPasswordState = { error: null };

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPassword, INITIAL);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

      <Field label="New Password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
        />
      </Field>

      <Field label="Confirm Password" htmlFor="confirmPassword" required>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Updating password…' : 'Set new password'}
      </Button>
    </form>
  );
}
