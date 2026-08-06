'use server';

import { timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface SignUpState {
  error: string | null;
}

/**
 * Longer than Supabase's default of six.
 *
 * Every provisioned account can read the entire client book — messages,
 * contact details, and gig pricing — so the floor is set by what the account
 * unlocks, not by what the auth provider will tolerate.
 */
const MIN_PASSWORD_LENGTH = 12;

const signUpSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name.').max(120, 'That name is too long.'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(72, 'Passwords are limited to 72 characters.'),
  inviteCode: z.string().min(1, 'Enter the invite code.'),
});

/**
 * The invite code, or null when sign-up is switched off.
 *
 * Sign-up fails closed. An unset `LENSELLO_SIGNUP_CODE` disables the route
 * rather than opening it: the deployment is a public URL, and `is_staff()`
 * grants any profile row full access to the client book, so an
 * accidentally-open form would hand the studio's data to whoever finds it.
 */
function expectedInviteCode(): string | null {
  return process.env.LENSELLO_SIGNUP_CODE?.trim() || null;
}

/** Constant-time compare, so the code cannot be recovered a character at a time. */
function codeMatches(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // timingSafeEqual throws on a length mismatch, and the length itself is not
  // the secret worth protecting.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function signUp(
  _previous: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    inviteCode: formData.get('inviteCode'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details.' };
  }

  const expectedCode = expectedInviteCode();
  if (!expectedCode) {
    return {
      error:
        'Sign-up is disabled. Set LENSELLO_SIGNUP_CODE in the environment to ' +
        'allow new accounts.',
    };
  }

  if (!codeMatches(parsed.data.inviteCode, expectedCode)) {
    return { error: 'That invite code is not valid.' };
  }

  const email = parsed.data.email.toLowerCase();
  const admin = createAdminClient();

  // email_confirm: true because there is no transactional mail provider wired
  // up yet — a confirmation link would never arrive and the account would be
  // stranded. Revisit when live mail exists.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });

  if (createError || !created.user) {
    const message = createError?.message ?? '';
    if (/already|exists|registered/i.test(message)) {
      return { error: 'An account with that email already exists. Sign in instead.' };
    }
    return { error: `The account could not be created: ${message || 'unknown error.'}` };
  }

  // The auth user alone cannot read anything — `requireUser` rejects a session
  // with no profile row, and every RLS policy goes through `is_staff()`. The
  // profile is what actually provisions the account.
  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    full_name: parsed.data.fullName,
    // Never 'owner'. Elevating an account is a deliberate act in the database,
    // not something a form can grant itself.
    role: 'staff',
  });

  if (profileError) {
    // Roll the auth user back. Leaving it behind would create an account that
    // can sign in, see nothing, and block the email from being retried.
    await admin.auth.admin.deleteUser(created.user.id);
    return {
      error: `The account could not be provisioned: ${profileError.message}`,
    };
  }

  // Sign the new account in on the cookie-bound client so they land in the app
  // rather than on a login form asking for what they just typed.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (signInError) {
    // The account is real and provisioned; only the session failed. Sending
    // them to the login form is the accurate outcome — reporting a generic
    // error here would imply nothing was created, and they would retry into
    // an "email already exists".
    redirect('/login');
  }

  redirect('/');
}
