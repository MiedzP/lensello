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
  const supabase = await createClient();
  const redirectTo = (next && next.startsWith('/') && !next.startsWith('//')) ? next : '/';

  try {
    // Find or create demo user
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'demo@lensello.local')
      .maybeSingle();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create demo user if doesn't exist
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: 'demo@lensello.local',
          password_hash: '', // Demo user has no password
          full_name: 'Demo User',
        })
        .select()
        .single();

      if (createError || !newUser) {
        throw new Error('Failed to create demo account');
      }

      userId = newUser.id;

      // Create demo profile
      await supabase.from('profiles').insert({
        user_id: userId,
        full_name: 'Demo User',
        role: 'staff',
      });
    }

    // Create JWT token for demo user
    const token = await createToken({
      userId,
      email: 'demo@lensello.local',
    });

    // Set auth cookie
    await setAuthCookie(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('Demo login error:', message);
    throw new Error('Demo login failed');
  }

  redirect(redirectTo as Route);
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
  redirect('/login');
}
