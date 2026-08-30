'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button, Field, Input, ErrorNote } from '@/components/ui';
import { requestReset, type ForgotPasswordState } from './actions';

const INITIAL: ForgotPasswordState = { error: null, success: false };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestReset, INITIAL);

  if (state.success) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            If that email address has an account with us, we've sent a password reset link.
            Check your inbox and follow the link to set a new password.
          </p>
        </div>
        <p className="text-sm text-slate-600">
          Didn't receive it?{' '}
          <button
            onClick={() => {
              // Reset the form to allow another attempt
              // In a real implementation, you'd use useFormStatus or similar
              window.location.reload();
            }}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Try again
          </button>
        </p>
        <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          Back to sign in →
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

      <Field label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Sending reset link…' : 'Send reset link'}
      </Button>

      <Link href="/login" className="block text-center text-sm text-blue-600 hover:text-blue-700">
        Remember your password? Sign in
      </Link>
    </form>
  );
}
