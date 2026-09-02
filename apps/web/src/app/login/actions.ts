'use server';

import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { verifyPassword } from '@/lib/auth/password';
import { createToken, setAuthCookie } from '@/lib/auth/jwt';

export interface LoginState {
  error: string | null;
}

const credentials = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
  // Only ever an in-app path, so a crafted ?next= can't bounce to another host.
  next: z
    .string()
    .optional()
    .transform((value) =>
      value && value.startsWith('/') && !value.startsWith('//') ? value : '/',
    ),
});

export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details.' };
  }

  const supabase = await createClient();
  const email = parsed.data.email.toLowerCase();

  try {
    // Find user by email
    const { data: user, error: queryError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (queryError || !user) {
      // Deliberately vague for security
      return { error: 'That email and password combination did not work.' };
    }

    // Verify password
    const passwordMatch = await verifyPassword(parsed.data.password, user.password_hash);
    if (!passwordMatch) {
      return { error: 'That email and password combination did not work.' };
    }

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      email: user.email,
    });

    // Set auth cookie
    await setAuthCookie(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('Login error:', message);
    return { error: 'Login failed. Please try again.' };
  }

  // `typedRoutes` wants a literal; the value is validated above as an in-app
  // path, so the cast is the documented escape hatch for a dynamic target.
  redirect(parsed.data.next as Route);
}

export async function demoLogin(next?: string): Promise<void> {
  const redirectTo = (next && next.startsWith('/') && !next.startsWith('//')) ? next : '/';

  try {
    // Create demo JWT token (doesn't require database)
    // Demo user ID: a fixed UUID for demo purposes
    const demoUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    const token = await createToken({
      userId: demoUserId,
      email: 'demo@lensello.local',
    });

    // Set auth cookie
    await setAuthCookie(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('Demo login error:', message);
    throw new Error('Demo login failed: ' + message);
  }

  redirect(redirectTo as Route);
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
  redirect('/login');
}
