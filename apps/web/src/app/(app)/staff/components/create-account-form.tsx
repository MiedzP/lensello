'use client';

import { useActionState, useRef } from 'react';
import { UserPlus } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, ErrorNote, Field, Input } from '@/components/ui';
import { CREATE_ACCOUNT_IDLE, createAccountAction } from '../actions';

/**
 * Making accounts directly, several in a row.
 *
 * The form clears and refocuses on success rather than collapsing, because the
 * case this exists for is setting up a handful of people in one sitting —
 * having to reopen it between each one is the whole friction it removes.
 */
export function CreateAccountForm() {
  const [state, action, pending] = useActionState(createAccountAction, CREATE_ACCOUNT_IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="mt-6">
      <CardHeader
        title="Create an account"
        description="Set someone up directly. They can sign in straight away — no link to send, no code to share."
      />
      <CardBody>
        <form
          ref={formRef}
          action={async (formData) => {
            await action(formData);
            // Cleared here rather than by remounting on a key, so the success
            // message stays on screen while the next one is typed.
            formRef.current?.reset();
            nameRef.current?.focus();
          }}
          className="space-y-4"
        >
          {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
          {state.message ? (
            <p role="status" aria-live="polite" className="text-sm text-success">
              {state.message}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Their name" htmlFor="new-name" required>
              <Input id="new-name" name="fullName" ref={nameRef} autoComplete="off" required />
            </Field>

            <Field label="Their email" htmlFor="new-email" required>
              <Input id="new-email" name="email" type="email" autoComplete="off" required />
            </Field>
          </div>

          <Field
            label="Temporary password"
            htmlFor="new-password"
            required
            hint="At least 12 characters. You will know it, so have them change it once they are in — or send an invitation instead and they pick their own."
          >
            <Input
              id="new-password"
              name="password"
              type="text"
              autoComplete="off"
              minLength={12}
              required
            />
          </Field>

          <p className="text-xs text-muted">
            Accounts are created as <span className="text-foreground">staff</span>.
            Making someone an owner is a deliberate change in the database, not
            something a form can grant.
          </p>

          <Button type="submit" variant="primary" disabled={pending}>
            <UserPlus size={14} aria-hidden="true" />
            {pending ? 'Creating…' : 'Create account'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
