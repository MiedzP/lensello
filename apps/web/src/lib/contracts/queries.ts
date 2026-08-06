/**
 * Reads for contract acceptance.
 *
 * Resolves the token and evaluates whether it can be signed in one place, the
 * way `resolveGallery` does. The clock is read here rather than in the page:
 * a component must not call an impure function during render, and the deadline
 * check needs the current instant.
 *
 * Runs with the service role, because a client signing an agreement has no
 * session and must not be granted one. Everything is scoped to the single
 * contract the token resolves to.
 */

import type { createAdminClient } from '@/lib/supabase/admin';
import type { Tables } from '@/lib/db.types';
import { hashToken } from '@/lib/crypto/share-token';
import { contractProblem, type ContractProblem } from './access';

type Admin = ReturnType<typeof createAdminClient>;

export interface ResolvedContract {
  contract: Tables<'contracts'>;
  problem: ContractProblem | null;
}

export async function resolveContract(
  admin: Admin,
  token: string,
): Promise<ResolvedContract | null> {
  const { data: contract } = await admin
    .from('contracts')
    .select('*')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (!contract) return null;

  return { contract, problem: contractProblem(contract, Date.now()) };
}
