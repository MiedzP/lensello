'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/db.types';

/**
 * Supabase client for Client Components — realtime subscriptions, direct
 * storage uploads. Mutations belong in Server Actions, not here.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
