import Link from 'next/link';
import { Camera } from 'lucide-react';
import { Nav } from '@/components/nav';
import { SignOutButton } from '@/components/sign-out-button';
import { requireUserOrRedirect } from '@/lib/auth';

/**
 * Shell for every signed-in route. `proxy.ts` already bounces anonymous
 * visitors; resolving the session here too means Server Components below can
 * assume a user without each re-checking.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile, user } = await requireUserOrRedirect();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-subtle bg-surface px-4 py-4 lg:w-56 lg:border-r lg:border-b-0 lg:px-3 lg:py-5">
        <Link
          href="/"
          className="flex items-center gap-2 px-2 text-sm font-semibold tracking-tight"
        >
          <Camera size={18} className="text-accent" aria-hidden="true" />
          Lensello
        </Link>

        <div className="lg:flex-1">
          <Nav />
        </div>

        <div className="hidden border-t border-subtle pt-4 lg:block">
          <p className="truncate px-3 text-xs font-medium text-foreground">
            {profile.full_name || user.email}
          </p>
          <p className="mt-0.5 px-3 text-xs text-faint capitalize">{profile.role}</p>
          <SignOutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
