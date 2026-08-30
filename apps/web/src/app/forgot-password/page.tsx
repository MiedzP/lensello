import { ForgotPasswordForm } from './forgot-password-form';

export const metadata = {
  title: 'Forgot Password - Lensello',
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Reset your password</h1>
          <p className="text-slate-600">
            Enter your email address and we'll send you a link to create a new password.
          </p>
        </div>

        {/* Form */}
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
