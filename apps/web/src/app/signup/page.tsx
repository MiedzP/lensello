import type { Metadata } from 'next';
import Link from 'next/link';
import { Camera } from 'lucide-react';
import { ErrorNote } from '@/components/ui';
import { SignUpForm } from './signup-form';

export const metadata: Metadata = { title: 'Create an account' };

/**
 * Rendered per request so that turning `LENSELLO_SIGNUP_CODE` on or off takes
 * effect immediately. Prerendering would bake today's answer into the build.
 */
export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  const enabled = Boolean(process.env.LENSELLO_SIGNUP_CODE?.trim());

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Camera size={26} className="text-accent" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold tracking-tight">Lensello</h1>
          <p className="mt-1 text-sm text-muted">
            Create a workspace account.
          </p>
        </div>

        {enabled ? (
          <SignUpForm />
        ) : (
          <ErrorNote>
            Sign-up is turned off. Set <code>LENSELLO_SIGNUP_CODE</code> in the
            deployment environment to allow new accounts, then reload this page.
          </ErrorNote>
        )}

        <p className="mt-6 text-center text-xs text-faint">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
