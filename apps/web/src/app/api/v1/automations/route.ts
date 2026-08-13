/**
 * `GET /api/v1/automations` — list automations, for a system that wants to
 * know what it can trigger.
 *
 * Authenticated by API key (`automations:read`), not a session — `/api/v1` is
 * public in `proxy.ts` for exactly this reason: a session cookie has nowhere
 * to come from on a server-to-server call.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiRequest } from '@/lib/automations/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request, 'automations:read');
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('automations')
    .select('id, name, description, trigger_kind, enabled, max_runs_per_day, last_run_at, run_count, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: `Could not load automations: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ automations: data ?? [] });
}
