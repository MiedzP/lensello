import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/db.types';

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 *
 * Carries the caller's session, so every query runs under their RLS context.
 * Never cache the returned client across requests — it is bound to one
 * request's cookies.
 */
export async function createClient() {
  // Async in Next.js 16; synchronous access was removed.
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. Session refresh happens in
            // proxy.ts, so ignoring this is safe rather than merely convenient.
          }
        },
      },
    },
  );
}
