/**
 * Setting up portal access.
 *
 * Two halves of the same handshake: staff issue a single-use setup link for a
 * client, and the client uses it once to choose their own passcode. "Invite
 * this client for the first time" and "this client forgot their passcode" are
 * the same operation from the database's point of view — both just need a
 * fresh token — so one function covers both, and the staff UI only differs in
 * which button it is behind.
 *
 * `client_portal_accounts` carries a staff RLS policy (`client_portal_accounts_staff_all`),
 * unlike the sessions and attempts tables — so every function here takes a
 * plain `SupabaseClient<Database>` rather than the admin-only alias. A staff
 * Server Action passes its own session's client and rides on RLS like every
 * other Server Action must; the public "forgot your passcode" flow and the
 * `/portal/setup` route, which have no session to carry, pass the service role.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/lib/db.types';
import { generateToken, hashToken } from '@/lib/crypto/share-token';
import { hashPassword } from '@/lib/galleries/tokens';

type Db = SupabaseClient<Database>;

/** Long enough that a client who is travelling still has time to open it. */
const SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PortalInviteResult =
  | { ok: true; account: Tables<'client_portal_accounts'>; /** Shown to staff once. Only its hash is stored. */ token: string }
  | { ok: false; error: string };

/**
 * Creates the client's portal account if one doesn't exist, and issues a
 * fresh setup token either way. Any token issued earlier for this account
 * stops working — a client who lost the first email should not be able to use
 * a link they later find in an old inbox alongside the newer one.
 */
export async function issuePortalInvite(
  db: Db,
  clientId: string,
  emailInput: string,
): Promise<PortalInviteResult> {
  const email = emailInput.trim().toLowerCase();
  if (!email) return { ok: false, error: 'An email address is required.' };

  const token = generateToken();
  const setupTokenHash = hashToken(token);
  const setupExpiresAt = new Date(Date.now() + SETUP_TTL_MS).toISOString();

  const { data: existing } = await db
    .from('client_portal_accounts')
    .select('id')
    .eq('client_id', clientId)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await db
      .from('client_portal_accounts')
      .update({
        email,
        setup_token_hash: setupTokenHash,
        setup_expires_at: setupExpiresAt,
        revoked_at: null,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error || !updated) {
      return { ok: false, error: error?.message ?? 'Could not update that account.' };
    }
    return { ok: true, account: updated, token };
  }

  const { data: created, error } = await db
    .from('client_portal_accounts')
    .insert({
      client_id: clientId,
      email,
      setup_token_hash: setupTokenHash,
      setup_expires_at: setupExpiresAt,
    })
    .select('*')
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? 'Could not create a portal account.' };
  }
  return { ok: true, account: created, token };
}

export type SetupTokenResult =
  | { ok: true; account: Tables<'client_portal_accounts'> }
  | { ok: false; error: string };

/** Looks up the account behind a setup token without consuming it. */
export async function resolveSetupToken(db: Db, token: string): Promise<SetupTokenResult> {
  const { data: account } = await db
    .from('client_portal_accounts')
    .select('*')
    .eq('setup_token_hash', hashToken(token))
    .maybeSingle();

  if (!account) return { ok: false, error: 'That link is not valid.' };
  if (account.revoked_at) return { ok: false, error: 'This account has been closed.' };
  if (!account.setup_expires_at || new Date(account.setup_expires_at).getTime() <= Date.now()) {
    return { ok: false, error: 'That link has expired. Ask your photographer to send a new one.' };
  }

  return { ok: true, account };
}

/**
 * Spends a setup token to set a passcode.
 *
 * Clears the token on success so the link cannot be used a second time — the
 * client's next passcode change goes through "forgot your passcode", which
 * issues a new one, rather than reusing this one indefinitely.
 *
 * Always called with the service role: the visitor spending the token has no
 * session, so there is no RLS context to ride on.
 */
export async function completeSetup(
  db: Db,
  token: string,
  passcode: string,
): Promise<SetupTokenResult> {
  const resolved = await resolveSetupToken(db, token);
  if (!resolved.ok) return resolved;

  const passcodeHash = await hashPassword(passcode);

  const { data: updated, error } = await db
    .from('client_portal_accounts')
    .update({ passcode_hash: passcodeHash, setup_token_hash: null, setup_expires_at: null })
    .eq('id', resolved.account.id)
    .select('*')
    .single();

  if (error || !updated) return { ok: false, error: error?.message ?? 'Could not save your passcode.' };
  return { ok: true, account: updated };
}

/** Closes a portal account. The client keeps no way to sign in until re-invited. */
export async function revokePortalAccount(db: Db, accountId: string): Promise<void> {
  await db
    .from('client_portal_accounts')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', accountId);
}
