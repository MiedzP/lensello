'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

// DISABLED: Password-based signup temporarily disabled
// To re-enable: see apps/web/src/lib/auth/_disabled/README.md

export function SignUpForm() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900">Account signup is temporarily disabled</p>
            <p className="text-sm text-yellow-800 mt-1">
              Password-based registration is not currently available. Contact your studio owner to be invited or for alternative signup methods.
            </p>
          </div>
        </div>
      </div>

      {/*
      DISABLED SIGNUP FORM - Kept for reference
      To restore: uncomment below and restore imports + actions

      <form action={action} className="space-y-4">
        <Field label="Name" htmlFor="fullName" required>
          <Input id="fullName" name="fullName" autoComplete="name" required autoFocus />
        </Field>
        <Field label="Email" htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password" required hint="At least 12 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required />
        </Field>
        <Field label="Invite code" htmlFor="inviteCode" required hint="From the studio owner.">
          <Input id="inviteCode" name="inviteCode" type="password" autoComplete="off" required />
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      */}

      <div className="rounded-lg border border-subtle bg-surface p-4 space-y-3">
        <p className="text-sm text-muted">
          Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
        <p className="text-xs text-faint">
          Need an account? Contact your studio owner for an invitation link or alternative registration methods.
        </p>
      </div>
    </div>
  );
}
