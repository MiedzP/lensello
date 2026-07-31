import type { Metadata } from 'next';
import { Camera } from 'lucide-react';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage(props: PageProps<'/login'>) {
  // searchParams is a Promise in Next.js 16.
  const { next } = await props.searchParams;
  const target = typeof next === 'string' ? next : '/';

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Camera size={26} className="text-accent" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold tracking-tight">Lensello</h1>
          <p className="mt-1 text-sm text-muted">Sign in to the studio workspace.</p>
        </div>

        <LoginForm next={target} />

        <p className="mt-6 text-center text-xs text-faint">
          Accounts are provisioned by the studio owner.
        </p>
      </div>
    </div>
  );
}
