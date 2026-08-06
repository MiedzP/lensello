'use server';

/**
 * Contract acceptance, by a client with a link and no account.
 *
 * Same rule as galleries: the token is the only thing trusted, re-resolved on
 * every call, and a contract id from the caller is never accepted.
 *
 * Acceptance is recorded once and never updated. A contract that could be
 * re-accepted, or accepted under a second name, would undermine the only thing
 * it is for.
 */

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashToken, hashVisitor } from '@/lib/crypto/share-token';

export interface ContractState {
  error: string | null;
  accepted: boolean;
}

export const CONTRACT_IDLE: ContractState = { error: null, accepted: false };

const schema = z.object({
  token: z.string().trim().min(20).max(200),
  // A signature is a name, not a checkbox. Requiring it typed is what makes
  // "who agreed" answerable.
  name: z
    .string()
    .trim()
    .min(2, 'Type your full name to accept.')
    .max(120, 'That name is too long.'),
});

export async function acceptContract(
  _previous: ContractState,
  formData: FormData,
): Promise<ContractState> {
  const parsed = schema.safeParse({
    token: formData.get('token'),
    name: formData.get('name'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form.', accepted: false };
  }

  const admin = createAdminClient();

  const { data: contract } = await admin
    .from('contracts')
    .select('id, status, expires_at')
    .eq('token_hash', hashToken(parsed.data.token))
    .maybeSingle();

  if (!contract) {
    return { error: 'That agreement could not be found.', accepted: false };
  }

  if (contract.status === 'accepted') {
    // Not an error: somebody double-submitting should be told it worked, not
    // that something went wrong.
    return { error: null, accepted: true };
  }

  if (contract.status === 'void') {
    return { error: 'This agreement has been withdrawn by the studio.', accepted: false };
  }

  if (contract.status === 'draft') {
    return { error: 'This agreement is not ready to sign yet.', accepted: false };
  }

  if (contract.expires_at && new Date(contract.expires_at).getTime() <= Date.now()) {
    return {
      error: 'This agreement has expired. Ask the studio to send a fresh one.',
      accepted: false,
    };
  }

  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim();

  // Guarded on the current status as well as the id: two simultaneous submits
  // must not both write an acceptance, and Postgres decides which wins rather
  // than a check-then-write that both could pass.
  const { data: updated, error } = await admin
    .from('contracts')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_name: parsed.data.name,
      accepted_ip_hash: ip ? hashVisitor(ip, 'contract') : null,
      accepted_user_agent: headerList.get('user-agent')?.slice(0, 400) ?? null,
    })
    .eq('id', contract.id)
    .eq('status', 'sent')
    .select('id')
    .maybeSingle();

  if (error) {
    return { error: `That could not be recorded: ${error.message}`, accepted: false };
  }

  // Lost the race — the other request accepted it. Still a success.
  if (!updated) return { error: null, accepted: true };

  revalidatePath(`/c/${parsed.data.token}`);
  return { error: null, accepted: true };
}
