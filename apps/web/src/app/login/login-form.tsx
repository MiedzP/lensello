'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui';
import { demoLogin, type LoginState } from './actions';

// DISABLED: Password authentication temporarily disabled
// To re-enable: see apps/web/src/lib/auth/_disabled/README.md

const INITIAL: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(
    async () => {
      await demoLogin(next);
    },
    INITIAL
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900">Password authentication is temporarily disabled</p>
            <p className="text-sm text-yellow-800 mt-1">
              Use the demo login below to access the app, or contact your studio owner for alternative methods.
            </p>
          </div>
        </div>
      </div>

      <form action={action}>
        <Button
          type="submit"
          disabled={pending}
          variant="primary"
          size="lg"
          className="w-full"
        >
          <LogIn size={16} className="mr-2" />
          {pending ? 'Signing in…' : 'Demo Login'}
        </Button>
      </form>

      {/*
      DISABLED PASSWORD FORM - Kept for reference
      To restore: uncomment below and restore imports + actions

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <div className="space-y-1">
          <Field label="Password" htmlFor="password" required>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <Link href="/forgot-password" className="inline-block text-xs text-blue-600 hover:text-blue-700 font-medium">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      */}

      <div className="rounded-lg border border-subtle bg-surface p-4">
        <p className="text-sm text-muted">
          Need help? Contact your studio owner or check the <Link href="/" className="text-accent hover:underline">home page</Link> for alternative sign-in options.
        </p>
      </div>
    </div>
  );
}
