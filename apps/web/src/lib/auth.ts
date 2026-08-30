/**
 * Authentication utilities for custom JWT-based auth
 *
 * Replaces Supabase Auth with a custom JWT token system.
 * Users are stored in public.users table with bcrypt-hashed passwords.
 * Sessions are JWT tokens stored in httpOnly cookies.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import type { Tables } from '@/lib/db.types';

export interface Session {
  user: { id: string; email: string };
  profile: Tables<'profiles'>;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Get the current user's session from the JWT cookie
 */
export async function getSession(): Promise<Session | null> {
  try {
    const jwtUser = await getCurrentUser();

    if (!jwtUser) {
      return null;
    }

    const supabase = await createClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', jwtUser.userId)
      .maybeSingle();

    if (!profile) {
      return null;
    }

    return {
      user: {
        id: jwtUser.userId,
        email: jwtUser.email,
      },
      profile,
      supabase,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Require authentication. Throws an error if no user is logged in.
 *
 * Call this at the top of EVERY Server Action. Server Actions are reachable by
 * direct POST — the fact that your UI only renders a button for staff proves
 * nothing about who can invoke the action.
 *
 * Throwing (rather than redirecting) is deliberate: a redirect from a mutation
 * reads as success to a programmatic caller.
 */
export async function requireUser(): Promise<Session> {
  const session = await getSession();

  if (!session) {
    throw new Error('Unauthorized: no authenticated user.');
  }

  return session;
}

/**
 * Page-level variant: redirects to the login screen instead of throwing.
 * Use in Server Components; use `requireUser` in Server Actions.
 */
export async function requireUserOrRedirect(): Promise<Session> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return session;
}

/**
 * Variant that also checks onboarding completion.
 * Redirects to /onboarding if not completed.
 */
export async function requireUserOrRedirectWithOnboarding(): Promise<Session> {
  const session = await requireUserOrRedirect();

  if (!session.profile.onboarding_completed) {
    redirect('/onboarding');
  }

  return session;
}
