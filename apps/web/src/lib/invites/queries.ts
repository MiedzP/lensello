/**
 * Reading and redeeming invitations.
 *
 * Redemption runs with the service role, because the person redeeming has no
 * account yet — that is the entire point of an invitation. Everything is scoped
 * to the single invite the token resolves to.
 */

import type { createAdminClient } from '@/lib/supabase/admin';
import type { Tables } from '@/lib/db.types';
import { hashToken } from '@/lib/crypto/share-token';

type Admin = ReturnType<typeof createAdminClient>;

export type InviteRow = Tables<'invites'>;

export type InviteProblem = 'revoked' | 'expired' | 'used';

/**
 * Why an invitation cannot be redeemed, or null when it can.
 *
 * Pure and given the instant, so the expiry boundary is testable and no
 * component has to read the clock during render.
 */
export function inviteProblem(
  invite: Pick<InviteRow, 'revoked_at' | 'expires_at' | 'accepted_at'>,
  now: number,
): InviteProblem | null {
  if (invite.revoked_at) return 'revoked';
  // Used before expired: "somebody already joined with this" is the more
  // useful thing to be told, and it is true regardless of the clock.
  if (invite.accepted_at) return 'used';
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= now) return 'expired';
  return null;
}

export interface ResolvedInvite {
  invite: InviteRow;
  problem: InviteProblem | null;
}

export async function resolveInvite(
  admin: Admin,
  token: string,
): Promise<ResolvedInvite | null> {
  const { data: invite } = await admin
    .from('invites')
    .select('*')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (!invite) return null;
  return { invite, problem: inviteProblem(invite, Date.now()) };
}
