import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminSignupForm from './components/admin-signup-form';

export const metadata = {
  title: 'Admin Signup - Lensello',
};

export default async function AdminSignupPage() {
  const supabase = await createClient();

  // Check if any users exist yet
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);

  // If users exist, redirect to normal login
  if (users && users.length > 0) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold text-slate-900">Lensello</h1>
          <p className="text-slate-600 mt-2">Studio Owner Setup</p>
        </div>

        <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>First time?</strong> Create your owner account to get started. This page is only available before any users are created.
          </p>
        </div>

        <AdminSignupForm />

        <p className="text-center text-xs text-slate-600">
          Already have an account? <a href="/login" className="text-blue-600 hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
