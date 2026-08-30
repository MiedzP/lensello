import Link from 'next/link';

export const metadata = {
  title: 'Invalid Reset Link - Lensello',
};

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Link expired or invalid</h1>
          <p className="text-slate-600">
            This password reset link is no longer valid. It may have expired or been used already.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/forgot-password"
            className="block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Request a new reset link
          </Link>
          <Link
            href="/login"
            className="block text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
