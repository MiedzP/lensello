import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Camera } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { PORTAL_COOKIE_NAME, readPortalSession } from '@/lib/portal/session';
import { getPortalClientName, listPortalGalleries } from '@/lib/portal/queries';
import { SignInForm } from './sign-in-form';
import { PortalDashboard } from './gallery-list';

/**
 * A client's own account, never indexed and never cached — same reasoning as
 * every other private route in the app: showing up in a search result or a
 * shared browser cache would leak whose photographs live behind this address.
 */
export const metadata: Metadata = {
  title: 'Client portal',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  const admin = createAdminClient();
  const store = await cookies();
  const session = await readPortalSession(admin, store.get(PORTAL_COOKIE_NAME)?.value);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <Camera size={26} className="text-accent" aria-hidden="true" />
            <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
              Your gallery portal
            </h1>
            <p className="mt-1 text-sm text-muted">
              Sign in to see every gallery your photographer has shared with you.
            </p>
          </div>
          <SignInForm />
        </div>
      </div>
    );
  }

  const { account } = session;
  const [galleries, clientName] = await Promise.all([
    listPortalGalleries(admin, account.client_id),
    getPortalClientName(admin, account.client_id, account.email),
  ]);

  return <PortalDashboard clientName={clientName} galleries={galleries} />;
}
