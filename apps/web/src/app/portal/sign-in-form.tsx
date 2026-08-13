'use client';

import { useActionState, useState } from 'react';
import { Button, ErrorNote, Field, Input } from '@/components/ui';
import { requestPasscodeReset, signIn } from './actions';
import { PORTAL_IDLE } from './portal-state';

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, PORTAL_IDLE);
  const [showReset, setShowReset] = useState(false);

  if (showReset) {
    return <ResetForm onBack={() => setShowReset(false)} />;
  }

  return (
    <form action={action} className="space-y-4">
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>

      <Field label="Passcode" htmlFor="passcode" required>
        <Input id="passcode" name="passcode" type="password" autoComplete="current-password" required />
      </Field>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>

      <button
        type="button"
        onClick={() => setShowReset(true)}
        className="w-full text-center text-xs text-muted hover:text-foreground hover:underline"
      >
        Forgot your passcode?
      </button>
    </form>
  );
}

function ResetForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(requestPasscodeReset, PORTAL_IDLE);

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">
        Enter the email your photographer has on file and we&rsquo;ll send you a
        link to choose a new passcode.
      </p>

      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
      {state.message ? (
        <p role="status" className="rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-sm text-success">
          {state.message}
        </p>
      ) : null}

      <Field label="Email" htmlFor="reset-email" required>
        <Input id="reset-email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Send me a link'}
      </Button>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-muted hover:text-foreground hover:underline"
      >
        Back to sign in
      </button>
    </form>
  );
}
