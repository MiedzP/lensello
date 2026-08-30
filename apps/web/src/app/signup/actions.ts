'use server';

import { timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth/password';
import { createToken, setAuthCookie } from '@/lib/auth/jwt';

export interface SignUpState {
  error: string | null;
}

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

function expectedInviteCode(): string | null {
  return process.env.LENSELLO_SIGNUP_CODE?.trim() || null;
}

function codeMatches(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied, 'utf8');
  const b = Buffer.from(expected, 'utf8');
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
  const supabase = await createClient();

  try {
    // Hash the password
    const passwordHash = await hashPassword(parsed.data.password);

    // Create user in users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        full_name: parsed.data.fullName,
      })
      .select()
      .single();

    if (userError || !user) {
      const message = userError?.message ?? '';
      if (/unique|already|exists/i.test(message)) {
        return { error: 'An account with that email already exists. Sign in instead.' };
      }
      console.error('User creation error:', userError);
      return { error: `Failed to create account: ${message || 'unknown error'}` };
    }

    // Create profile to provision the account
    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: user.id,
      full_name: parsed.data.fullName,
      role: 'staff', // Never 'owner' — that's a deliberate admin action
    });

    if (profileError) {
      // Rollback: delete the user we just created
      await supabase.from('users').delete().eq('id', user.id);
      console.error('Profile creation error:', profileError);
      return { error: `Account setup failed: ${profileError.message}` };
    }

    // Create JWT token and set cookie
    const token = await createToken({
      userId: user.id,
      email: user.email,
    });

    await setAuthCookie(token);

    // Redirect to dashboard
    redirect('/');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'unknown error';
    console.error('Signup error:', errorMsg);
    return { error: `Sign-up failed: ${errorMsg}` };
  }
}
