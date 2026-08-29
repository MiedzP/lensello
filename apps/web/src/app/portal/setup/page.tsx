import type { Metadata } from 'next';
import { Camera } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveSetupToken } from '@/lib/portal/invite';
import { SetupForm } from './setup-form';

export const metadata: Metadata = {
  title: 'Set your passcode',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';

export default async function PortalSetupPage(props: PageProps<'/portal/setup'>) {
  const { token } = await props.searchParams;
  const rawToken = typeof token === 'string' ? token : '';

  const admin = createAdminClient();
  const resolved = rawToken
    ? await resolveSetupToken(admin, rawToken)
    : ({ ok: false, error: 'That link is not valid.' } as const);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Camera size={26} className="text-accent" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
            Set your passcode
          </h1>
          <p className="mt-1 text-sm text-muted">
            Choose a passcode to sign in to your gallery portal from now on.
          </p>
        </div>

        {resolved.ok === true ? (
          <SetupForm token={rawToken} email={resolved.account.email} />
        ) : (
          <p className="text-center text-sm text-danger">{resolved.error}</p>
        )}
      </div>
    </div>
  );
}
