import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ResetPasswordForm } from './reset-password-form';

export const metadata = {
  title: 'Set New Password - Lensello',
};

export default async function ResetPasswordPage() {
  // Verify there's an active recovery session.
  // A recovery session is set by the /auth/callback route after a code exchange.
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    // No valid session — redirect back to request a new reset link
    redirect('/forgot-password');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create a new password</h1>
          <p className="text-slate-600">
            Enter a strong password to secure your account.
          </p>
        </div>

        {/* Form */}
        <ResetPasswordForm />
      </div>
    </div>
  );
}
