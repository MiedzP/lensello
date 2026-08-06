import type { Metadata } from 'next';
import Link from 'next/link';
import { Camera } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveInvite } from '@/lib/invites/queries';
import { JoinForm } from './join-form';

export const metadata: Metadata = {
  title: 'Join',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

function Closed({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <div className="text-center">
        <Camera size={26} className="mx-auto text-faint" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <p className="mt-6 text-xs text-faint">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </Shell>
  );
}

export default async function JoinPage(props: PageProps<'/join/[token]'>) {
  const { token } = await props.params;

  const admin = createAdminClient();
  const resolved = await resolveInvite(admin, token);

  // Same message for a wrong token and a deleted invitation, so guessing tells
  // you nothing about whether you found a real one.
  if (!resolved) {
    return (
      <Closed
        title="Invitation not found"
        body="This link doesn't match an invitation. Check you have the whole address, or ask the studio to send a new one."
      />
    );
  }

  if (resolved.problem === 'revoked') {
    return (
      <Closed
        title="This invitation was withdrawn"
        body="The studio has cancelled it. Ask them for a new link if you still need access."
      />
    );
  }

  if (resolved.problem === 'used') {
    return (
      <Closed
        title="This invitation has been used"
        body="An account has already been created with this link. Sign in with it, or ask the studio for a new invitation."
      />
    );
  }

  if (resolved.problem === 'expired') {
    return (
      <Closed
        title="This invitation has expired"
        body="Ask the studio for a fresh link and you'll be able to join straight away."
      />
    );
  }

  return (
    <Shell>
      <div className="mb-8 text-center">
        <Camera size={26} className="mx-auto text-accent" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold tracking-tight">Join Lensello</h1>
        <p className="mt-1 text-sm text-muted">
          {resolved.invite.note?.trim()
            ? resolved.invite.note
            : 'You have been invited to the studio workspace. Set up your account below.'}
        </p>
      </div>

      <JoinForm token={token} lockedEmail={resolved.invite.email} />

      <p className="mt-6 text-center text-xs text-faint">
        This link works once. Once you have joined, it stops working.
      </p>
    </Shell>
  );
}
