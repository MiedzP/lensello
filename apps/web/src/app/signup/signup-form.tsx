'use client';

import { useActionState } from 'react';
import { Button, Field, Input, ErrorNote } from '@/components/ui';
import { signUp, type SignUpState } from './actions';

const INITIAL: SignUpState = { error: null };

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, INITIAL);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

      <Field label="Name" htmlFor="fullName" required>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          autoFocus
        />
      </Field>

      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        hint="At least 12 characters."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </Field>

      <Field
        label="Invite code"
        htmlFor="inviteCode"
        required
        hint="From the studio owner."
      >
        <Input
          id="inviteCode"
          name="inviteCode"
          type="password"
          autoComplete="off"
          required
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={pending}
      >
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
