'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export interface ResetPasswordState {
  error: string | null;
}

/**
 * Must match the minimum in signup/actions.ts for consistency.
 * This is the floor set by the fact that every provisioned account
 * can read the entire client book.
 */
const MIN_PASSWORD_LENGTH = 12;

const resetSchema = z.object({
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(72, 'Passwords are limited to 72 characters.'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ['confirmPassword'],
});

export async function resetPassword(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details.' };
  }

  const supabase = await createClient();

  // Verify there's an active recovery session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Your session has expired. Request a new reset link.' };
  }

  // Update the password with the recovery session
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    console.error('Password update error:', error);
    return { error: `Unable to update password: ${error.message || 'unknown error'}` };
  }

  // Success — the session is now signed in with the new password
  redirect('/');
}
