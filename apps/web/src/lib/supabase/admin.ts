/**
 * Service-role Supabase client. Bypasses RLS entirely.
 *
 * Exists for the two operations the schema deliberately makes impossible for a
 * normal session: creating an `auth.users` row, and inserting into `profiles`
 * — which has no INSERT policy, because provisioning staff is an admin action
 * (see 20260731150000_init.sql). It is also the only reader of
 * `social_account_secrets`, which has RLS on and no policies at all.
 *
 * Never import this from a Client Component. `SUPABASE_SERVICE_ROLE_KEY` has no
 * `NEXT_PUBLIC_` prefix so it cannot be inlined into a browser bundle, but the
 * guard below turns a mistaken import into a loud failure rather than a client
 * that silently has no credentials.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db.types';

export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createAdminClient() was called in the browser. The service role key is ' +
        'server-only; move this call into a Server Action or Route Handler.',
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Admin operations need NEXT_PUBLIC_SUPABASE_URL and ' +
        'SUPABASE_SERVICE_ROLE_KEY. Set both in the deployment environment.',
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    // No cookies, no refresh loop: this client is constructed per request and
    // must never pick up or persist a user session.
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
