/**
 * `GET /api/v1/automations/[id]/runs` — recent run history, for a caller that
 * triggered a run and wants to know what happened to it.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiRequest } from '@/lib/automations/api-auth';

export const dynamic = 'force-dynamic';

const LIMIT = 20;

export async function GET(request: Request, context: RouteContext<'/api/v1/automations/[id]/runs'>) {
  const auth = await authenticateApiRequest(request, 'automations:read');
  if (auth.ok === false) return auth.response;

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'That is not a valid automation id.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('automation_runs')
    .select('id, status, skip_reason, error, started_at, finished_at')
    .eq('automation_id', id)
    .order('started_at', { ascending: false })
    .limit(LIMIT);

  if (error) {
    return NextResponse.json({ error: `Could not load run history: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ runs: data ?? [] });
}
