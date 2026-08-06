import type { Metadata } from 'next';
import { UserPlus } from 'lucide-react';
import { Card, CardBody, ErrorNote, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { listStaff } from '@/lib/staff/queries';
import { addedLabel, exactTime, signInLabel } from '@/lib/staff/format';
import { StaffList, type StaffRowView } from './components/staff-list';

export const metadata: Metadata = { title: 'Staff' };

/**
 * Rendered per request. A roster cached at build time would show stale
 * sign-in times, which is the one column on this page that is only useful when
 * it is current.
 */
export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const { supabase, user, profile } = await requireUserOrRedirect();
  const isOwner = profile.role === 'owner';

  let rows: StaffRowView[] = [];
  let loadError: string | null = null;

  try {
    const members = await listStaff(supabase, createAdminClient());
    rows = members.map((member) => ({
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      role: member.role,
      isProvisioned: member.isProvisioned,
      addedLabel: addedLabel(member.addedAt),
      signInLabel: signInLabel(member.lastSignInAt),
      signInExact: exactTime(member.lastSignInAt),
      isSelf: member.id === user.id,
    }));
  } catch (cause) {
    loadError = cause instanceof Error ? cause.message : 'The roster could not be loaded.';
  }

  const signUpEnabled = Boolean(process.env.LENSELLO_SIGNUP_CODE?.trim());

  return (
    <>
      <PageHeader
        title="Staff"
        description="Every account that can sign in to this workspace, and when it last did."
      />

      {loadError ? <ErrorNote>{loadError}</ErrorNote> : null}

      <Card>
        {rows.length > 0 ? (
          <StaffList rows={rows} canRemove={isOwner} />
        ) : (
          <CardBody className="text-sm text-muted">
            No accounts found.
          </CardBody>
        )}
      </Card>

      {isOwner ? (
        <Card className="mt-6">
          <CardBody className="flex gap-3 text-sm text-muted">
            <UserPlus
              size={18}
              className="mt-0.5 shrink-0 text-faint"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Adding someone</p>
              {signUpEnabled ? (
                <p>
                  Send them <span className="text-foreground">/signup</span> along
                  with the current invite code. The code is the value of{' '}
                  <code>LENSELLO_SIGNUP_CODE</code> in the deployment
                  environment — it is a shared secret, so it is not printed here.
                  New accounts are created as <span className="text-foreground">staff</span>.
                </p>
              ) : (
                <p>
                  Sign-up is turned off. Set <code>LENSELLO_SIGNUP_CODE</code> in
                  the deployment environment to open{' '}
                  <span className="text-foreground">/signup</span>, then share
                  that code with the person joining.
                </p>
              )}
              <p>
                Removing an account deletes the login and its profile together.
                You cannot remove your own.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
