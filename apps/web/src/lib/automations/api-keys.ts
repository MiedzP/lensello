/**
 * Minting and verifying `/api/v1` keys.
 *
 * Non-negotiables, per the brief:
 *  - Only `sha256(key)` is ever stored. The raw key is returned once, at
 *    creation, and is not reconstructable from anything in the database —
 *    `key_prefix` is display-only, copied from the key before hashing purely
 *    so a list of keys is tell-apart-able ("ends in ...4f2a") without holding
 *    working credentials.
 *  - Comparison is constant-time. The database lookup is by exact hash match
 *    (an index scan, not a string compare, so there is nothing to time), and
 *    the equality check below is `timingSafeEqual` anyway, as a second,
 *    defence-in-depth layer that does not depend on that reasoning holding.
 *  - The raw key is never logged. Every function here takes it as a plain
 *    argument and none of them call `console.*` with it — grep for `presented`
 *    or `key` in this file if that ever needs re-checking.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { createAdminClient } from '@/lib/supabase/admin';
import { API_KEY_SCOPE_VALUES } from './schemas';

type Admin = ReturnType<typeof createAdminClient>;

export type ApiKeyScope = (typeof API_KEY_SCOPE_VALUES)[number];
export { API_KEY_SCOPE_VALUES as API_KEY_SCOPES };

const KEY_PREFIX = 'lsk_';
const KEY_BYTES = 32;
/** How much of the key is kept in the clear for display. Not enough to guess the rest. */
const DISPLAY_PREFIX_LENGTH = 12;

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export interface MintedApiKey {
  /** Shown once. Never persisted anywhere in this shape. */
  key: string;
  prefix: string;
  hash: string;
}

export function generateApiKey(): MintedApiKey {
  const key = `${KEY_PREFIX}${randomBytes(KEY_BYTES).toString('base64url')}`;
  return { key, prefix: key.slice(0, DISPLAY_PREFIX_LENGTH), hash: hashApiKey(key) };
}

export interface VerifiedApiKey {
  id: string;
  name: string;
  scopes: ApiKeyScope[];
}

function looksLikeAKey(presented: string): boolean {
  return presented.startsWith(KEY_PREFIX) && presented.length >= 20;
}

/**
 * Looks a presented key up by its hash and returns what it is allowed to do,
 * or `null` for anything wrong with it — unknown, revoked, expired, malformed.
 * Deliberately one undifferentiated failure mode: telling an unauthenticated
 * caller *which* of those is true would be handing out information about
 * whether a guessed key exists.
 */
export async function verifyApiKey(admin: Admin, presented: string): Promise<VerifiedApiKey | null> {
  if (!presented || !looksLikeAKey(presented)) return null;

  const hash = hashApiKey(presented);

  const { data: row } = await admin
    .from('api_keys')
    .select('id, name, key_hash, scopes, revoked_at, expires_at')
    .eq('key_hash', hash)
    .maybeSingle();

  if (!row) return null;

  const a = Buffer.from(row.key_hash, 'utf8');
  const b = Buffer.from(hash, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null;

  // Best-effort and never awaited by the caller: a slow or failed update to
  // `last_used_at` must not add latency to, or fail, the request it is timing.
  void admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id)
    .then(
      ({ error }) => {
        if (error) console.error('[automations] could not record api key use', row.id, error.message);
      },
      (cause: unknown) => console.error('[automations] could not record api key use', row.id, cause),
    );

  return { id: row.id, name: row.name, scopes: (row.scopes ?? []) as ApiKeyScope[] };
}

/** A key with no scopes can do nothing — every /api/v1 route calls this before acting. */
export function hasScope(key: VerifiedApiKey, scope: ApiKeyScope): boolean {
  return key.scopes.includes(scope);
}
