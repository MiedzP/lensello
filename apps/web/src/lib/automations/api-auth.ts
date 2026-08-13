/**
 * Shared authentication for every `/api/v1` route.
 *
 * `proxy.ts` lists `/api/v1` as public — it has no session to bounce and no
 * cookie to refresh — so authentication is entirely this function's job, not
 * a convenience layer on top of one. Every route calls this first, with the
 * one scope it needs, before touching the database.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasScope, verifyApiKey, type ApiKeyScope, type VerifiedApiKey } from './api-keys';

export type ApiAuthResult =
  | { ok: true; key: VerifiedApiKey }
  | { ok: false; response: NextResponse };

export async function authenticateApiRequest(
  request: Request,
  requiredScope: ApiKeyScope,
): Promise<ApiAuthResult> {
  const header = request.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

  if (!presented) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Missing API key. Send it as `Authorization: Bearer <key>`.' },
        { status: 401 },
      ),
    };
  }

  const admin = createAdminClient();
  const key = await verifyApiKey(admin, presented);

  if (!key) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'That API key is invalid, revoked, or expired.' }, { status: 401 }),
    };
  }

  if (!hasScope(key, requiredScope)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `This key does not have the "${requiredScope}" scope.` },
        { status: 403 },
      ),
    };
  }

  return { ok: true, key };
}
