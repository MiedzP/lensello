'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';

export interface AccountState {
  error: string | null;
  success: boolean;
}

const MIN_PASSWORD_LENGTH = 12;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(72, 'Passwords are limited to 72 characters.'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match.",
  path: ['confirmPassword'],
});

export async function changePassword(
  _previous: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details.', success: false };
  }

  const session = await requireUser();
  const supabase = await createClient();

  // Re-authenticate with the current password first.
  // This prevents someone from changing the password on a borrowed/unattended machine.
  const { error: reAuthError } = await supabase.auth.signInWithPassword({
    email: session.user.email || '',
    password: parsed.data.currentPassword,
  });

  if (reAuthError) {
    return { error: 'Current password is incorrect.', success: false };
  }

  // Now update to the new password
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (updateError) {
    console.error('Password update error:', updateError);
    return { error: `Unable to update password: ${updateError.message || 'unknown error'}`, success: false };
  }

  return {
    error: null,
    success: true,
  };
}
