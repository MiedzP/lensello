'use server';

import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

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
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately vague: distinguishing "no such user" from "wrong password"
    // tells an attacker which emails are registered.
    return { error: 'That email and password combination did not work.' };
  }

  // `typedRoutes` wants a literal; the value is validated above as an in-app
  // path, so the cast is the documented escape hatch for a dynamic target.
  redirect(parsed.data.next as Route);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
