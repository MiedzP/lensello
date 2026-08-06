'use client';

import { useActionState } from 'react';
import { Check } from 'lucide-react';
import { Button, ErrorNote, Input } from '@/components/ui';
import { CONTRACT_IDLE, acceptContract } from './actions';

export function AcceptForm({
  token,
  alreadyAccepted,
  acceptedName,
  acceptedAt,
}: {
  token: string;
  alreadyAccepted: boolean;
  acceptedName: string | null;
  acceptedAt: string | null;
}) {
  const [state, action, pending] = useActionState(acceptContract, CONTRACT_IDLE);

  if (alreadyAccepted || state.accepted) {
    return (
      <div
        role="status"
        className="rounded-lg border border-success/30 bg-success-subtle px-5 py-6 text-center"
      >
        <Check size={22} className="mx-auto text-success" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-foreground">
          Agreement accepted.
        </p>
        <p className="mt-1 text-sm text-muted">
          {acceptedName && acceptedAt
            ? `Signed by ${acceptedName} on ${new Date(acceptedAt).toLocaleDateString(
                'en-GB',
                { day: 'numeric', month: 'long', year: 'numeric' },
              )}.`
            : 'Thank you — the studio has been notified.'}
        </p>
        <p className="mt-3 text-xs text-faint">
          Keep this page for your records, or ask the studio for a copy.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-strong p-5">
      {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

      <label htmlFor="signature" className="block text-sm font-medium text-foreground">
        Type your full name to accept
      </label>
      <Input
        id="signature"
        name="name"
        autoComplete="name"
        placeholder="Your full name"
        required
      />
      <input type="hidden" name="token" value={token} />

      <p className="text-xs text-muted">
        Typing your name here has the same effect as signing. The date, and the
        exact wording above, are recorded with it.
      </p>

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Recording…' : 'I agree to these terms'}
      </Button>
    </form>
  );
}
