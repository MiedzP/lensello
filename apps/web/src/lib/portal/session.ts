/**
 * Portal sessions.
 *
 * A client signing in gets a row in `client_portal_sessions`, not a signed
 * token. That is the whole point of the table existing: revoking access —
 * closing the account, or the client simply forgetting they were signed in on
 * a hotel laptop — takes effect on the very next request, because the row is
 * gone or its account is. A signed cookie could not do that without also
 * rotating a secret and invalidating every other session at the same time.
 *
 * The cookie itself holds nothing but the raw session token; everything that
 * matters (which account, whether it has expired, whether it was revoked)
 * lives in the database and is checked on every read.
 */

import type { createAdminClient } from '@/lib/supabase/admin';
import type { Tables } from '@/lib/db.types';
import { generateToken, hashToken } from '@/lib/crypto/share-token';

type Admin = ReturnType<typeof createAdminClient>;

export const PORTAL_COOKIE_NAME = 'lensello_portal';

/** A client coming back for prints a year later should not have to sign in again every week. */
export const PORTAL_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface PortalSession {
  account: Tables<'client_portal_accounts'>;
}

/** Mints a new session row and returns the raw token to set as a cookie. */
export async function createPortalSession(
  admin: Admin,
  accountId: string,
  ipHash: string | null,
): Promise<string> {
  const token = generateToken();

  await admin.from('client_portal_sessions').insert({
    account_id: accountId,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + PORTAL_SESSION_TTL_SECONDS * 1000).toISOString(),
    ip_hash: ipHash,
  });

  return token;
}

/**
 * Resolves a session cookie to the account behind it, or null.
 *
 * Refuses a session whose account has been revoked even though the session
 * row itself has not expired yet — closing an account is meant to take effect
 * immediately, not wait for every outstanding session to time out on its own.
 */
export async function readPortalSession(
  admin: Admin,
  cookieValue: string | undefined,
): Promise<PortalSession | null> {
  if (!cookieValue) return null;

  const { data: session } = await admin
    .from('client_portal_sessions')
    .select('id, account_id, expires_at')
    .eq('token_hash', hashToken(cookieValue))
    .maybeSingle();

  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;

  const { data: account } = await admin
    .from('client_portal_accounts')
    .select('*')
    .eq('id', session.account_id)
    .maybeSingle();

  if (!account || account.revoked_at) return null;

  // Best effort — a "last seen" timestamp for staff is a nice-to-have, not
  // something worth failing a page load over.
  try {
    await admin
      .from('client_portal_accounts')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', account.id);
  } catch (cause) {
    console.error('[portal] could not record last seen', cause);
  }

  return { account };
}

/** Signs out one session. Safe to call with no cookie present. */
export async function destroyPortalSession(
  admin: Admin,
  cookieValue: string | undefined,
): Promise<void> {
  if (!cookieValue) return;
  await admin.from('client_portal_sessions').delete().eq('token_hash', hashToken(cookieValue));
}

/**
 * Every session belonging to an account.
 *
 * Used when a portal account is revoked from the staff side: the account row
 * being closed already blocks `readPortalSession`, but clearing the sessions
 * too means there is nothing left to clean up later and no stale row sitting
 * in the table pointing at a closed account.
 */
export async function destroyAllSessionsForAccount(
  admin: Admin,
  accountId: string,
): Promise<void> {
  await admin.from('client_portal_sessions').delete().eq('account_id', accountId);
}
