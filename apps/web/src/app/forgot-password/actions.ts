'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export interface ForgotPasswordState {
  error: string | null;
  success: boolean;
}

const emailSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
});

export async function requestReset(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = emailSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details.', success: false };
  }

  const supabase = await createClient();

  // Get the base URL from headers (works in Server Components/Actions)
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '') ||
                 process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                 'http://localhost:3000';

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Always return success, regardless of whether the user exists
  // This prevents attackers from enumerating registered emails
  if (error) {
    console.error('Password reset error (user will see generic message):', error);
  }

  return {
    error: null,
    success: true,
  };
}
