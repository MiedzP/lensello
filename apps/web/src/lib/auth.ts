import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/db.types';

export interface Session {
  user: { id: string; email: string | null };
  profile: Tables<'profiles'>;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Resolves the caller, or throws.
 *
 * Call this at the top of EVERY Server Action. Server Actions are reachable by
 * direct POST — the fact that your UI only renders a button for staff proves
 * nothing about who can invoke the action.
 *
 * Throwing (rather than redirecting) is deliberate: a redirect from a mutation
 * reads as success to a programmatic caller.
 */
export async function requireUser(): Promise<Session> {
  const supabase = await createClient();

  // getUser() revalidates the JWT with Supabase. Do not substitute getSession(),
  // which trusts an unverified cookie payload.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized: no authenticated user.');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  // Authenticated but not provisioned staff. RLS would deny every query
  // anyway; failing here produces a comprehensible error instead of a
  // confusing empty result set.
  if (!profile) {
    throw new Error(
      'Forbidden: this account is not provisioned for the Lensello workspace.',
    );
  }

  return {
    user: { id: user.id, email: user.email ?? null },
    profile,
    supabase,
  };
}

/**
 * Page-level variant: redirects to the login screen instead of throwing.
 * Use in Server Components; use `requireUser` in Server Actions.
 */
export async function requireUserOrRedirect(): Promise<Session> {
  try {
    return await requireUser();
  } catch {
    redirect('/login');
  }
}

/**
 * Variant that also checks onboarding completion.
 * Redirects to /onboarding if not completed.
 */
export async function requireUserOrRedirectWithOnboarding(): Promise<Session> {
  const session = await requireUserOrRedirect();

  // Check if onboarding is completed
  if (!session.profile.onboarding_completed) {
    redirect('/onboarding');
  }

  return session;
}

/** Returns the session, or null. For UI that renders differently when signed out. */
export async function getSession(): Promise<Session | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}
