/**
 * Portal sign-in: email plus passcode, rate-limited.
 *
 * The passcode check reuses `verifyPassword` from `lib/galleries/tokens` —
 * scrypt with an embedded salt, the same primitive `galleries.password_hash`
 * already uses, because it is the same problem: a human chose a short secret
 * and it needs a slow hash, not because galleries and the portal are related
 * features.
 *
 * The throttle mirrors `lib/inquiries/submit.ts`'s shape almost exactly — same
 * problem, a sibling table (`client_portal_attempts` next to
 * `inquiry_attempts`) — but checks both the email being tried and the caller's
 * address independently, so guessing many passcodes against one account from a
 * shared connection and credential-stuffing many addresses from one machine
 * are both caught.
 */

import type { createAdminClient } from '@/lib/supabase/admin';
import type { Tables } from '@/lib/db.types';
import { verifyPassword } from '@/lib/galleries/tokens';

type Admin = ReturnType<typeof createAdminClient>;

const MAX_FAILURES_PER_EMAIL = 8;
const MAX_FAILURES_PER_IP = 20;
const WINDOW_MS = 60 * 60 * 1000;

export class PortalThrottled extends Error {
  constructor() {
    super('Too many attempts. Wait a while and try again.');
    this.name = 'PortalThrottled';
  }
}

async function countRecentFailures(
  admin: Admin,
  column: 'email' | 'ip_hash',
  value: string,
  since: string,
): Promise<number> {
  const { count } = await admin
    .from('client_portal_attempts')
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
    .eq('succeeded', false)
    .gte('created_at', since);
  return count ?? 0;
}

async function recordAttempt(
  admin: Admin,
  email: string,
  ipHash: string | null,
  succeeded: boolean,
): Promise<void> {
  await admin.from('client_portal_attempts').insert({ email, ip_hash: ipHash, succeeded });

  // Prune opportunistically rather than on a schedule: the table only exists to
  // answer "how many recently", so anything outside every window that will ever
  // be checked is dead weight, and this keeps it from growing without a cron.
  await admin
    .from('client_portal_attempts')
    .delete()
    .lt('created_at', new Date(Date.now() - WINDOW_MS * 24).toISOString());
}

async function enforceThrottle(admin: Admin, email: string, ipHash: string | null): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  if ((await countRecentFailures(admin, 'email', email, since)) >= MAX_FAILURES_PER_EMAIL) {
    throw new PortalThrottled();
  }
  if (ipHash && (await countRecentFailures(admin, 'ip_hash', ipHash, since)) >= MAX_FAILURES_PER_IP) {
    throw new PortalThrottled();
  }
}

export type PortalSignInResult =
  | { ok: true; account: Tables<'client_portal_accounts'> }
  | { ok: false; error: string };

/** The one message for every failure mode: wrong email, no account, no passcode set, wrong passcode. */
const GENERIC_FAILURE = 'That email and passcode do not match.';

export async function signInWithPasscode(
  admin: Admin,
  emailInput: string,
  passcode: string,
  ipHash: string | null,
): Promise<PortalSignInResult> {
  const email = emailInput.trim().toLowerCase();
  if (!email || !passcode) {
    return { ok: false, error: 'Enter your email and passcode.' };
  }

  await enforceThrottle(admin, email, ipHash);

  const { data: account } = await admin
    .from('client_portal_accounts')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (!account || account.revoked_at || !account.passcode_hash) {
    await recordAttempt(admin, email, ipHash, false);
    return { ok: false, error: GENERIC_FAILURE };
  }

  const valid = await verifyPassword(passcode, account.passcode_hash);
  await recordAttempt(admin, email, ipHash, valid);

  if (!valid) return { ok: false, error: GENERIC_FAILURE };

  return { ok: true, account };
}
