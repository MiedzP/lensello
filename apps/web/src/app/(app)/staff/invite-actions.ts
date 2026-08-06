'use server';

/**
 * Creating and withdrawing invitations.
 *
 * Owner-only, enforced here rather than by hiding the form. The link is shown
 * once and only its hash is stored, so a database leak hands over no working
 * invitations — the same trade as galleries and contracts. Lose one and you
 * issue another.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { generateToken, hashToken } from '@/lib/crypto/share-token';
import { recordAudit } from '@/lib/privacy/audit';
import { friendlyDbError } from '@/lib/schema-errors';

export interface InviteState {
  error: string | null;
  message: string | null;
  /** Shown once, immediately after creation. Never retrievable again. */
  inviteUrl: string | null;
}

export const INVITE_IDLE: InviteState = { error: null, message: null, inviteUrl: null };

const createSchema = z.object({
  // Optional: an open invitation is useful for "send this to whoever you hire",
  // a locked one for a person you can already name.
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.toLowerCase() : undefined))
    .refine(
      (value) => value === undefined || /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value),
      'That email address does not look right.',
    ),
  note: z.string().trim().max(200).optional(),
  expiresInDays: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : 14))
    .refine(
      (value) => Number.isInteger(value) && value > 0 && value <= 90,
      'Pick between 1 and 90 days.',
    ),
});

export async function createInvite(
  _previous: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const { supabase, user, profile } = await requireUser();

  if (profile.role !== 'owner') {
    return { ...INVITE_IDLE, error: 'Only an owner can invite people.' };
  }

  const parsed = createSchema.safeParse({
    email: formData.get('email') || undefined,
    note: formData.get('note') || undefined,
    expiresInDays: formData.get('expiresInDays') || undefined,
  });

  if (!parsed.success) {
    return { ...INVITE_IDLE, error: parsed.error.issues[0]?.message ?? 'Check those details.' };
  }

  const input = parsed.data;
  const token = generateToken();

  const { data: invite, error } = await supabase
    .from('invites')
    .insert({
      token_hash: hashToken(token),
      email: input.email ?? null,
      note: input.note ?? null,
      // Always 'staff'. Elevating an account stays a deliberate act in the
      // database, not something a link can confer.
      role: 'staff',
      expires_at: new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString(),
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !invite) {
    return { ...INVITE_IDLE, error: friendlyDbError(error, 'The invitation could not be created.') };
  }

  await recordAudit(
    supabase,
    { id: user.id, email: user.email },
    {
      action: 'account.invited',
      subjectType: 'account',
      subjectId: invite.id,
      // The address is recorded because "who was invited" is exactly the
      // question asked later; the token never is.
      detail: { invited: input.email ?? '(open link)', expiresInDays: input.expiresInDays },
    },
  );

  revalidatePath('/staff');

  return {
    error: null,
    message: 'Invitation ready. Copy the link now — it cannot be shown again.',
    inviteUrl: `/join/${token}`,
  };
}

export async function revokeInvite(
  _previous: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const { supabase, profile } = await requireUser();

  if (profile.role !== 'owner') {
    return { ...INVITE_IDLE, error: 'Only an owner can withdraw an invitation.' };
  }

  const inviteId = z.string().uuid().safeParse(formData.get('inviteId'));
  if (!inviteId.success) return { ...INVITE_IDLE, error: 'Unknown invitation.' };

  // An accepted invitation is left alone: it records that somebody joined, and
  // withdrawing it would neither remove their account nor be true.
  const { data: updated, error } = await supabase
    .from('invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId.data)
    .is('accepted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return { ...INVITE_IDLE, error: friendlyDbError(error, 'That could not be withdrawn.') };
  }

  if (!updated) {
    return {
      ...INVITE_IDLE,
      error:
        'That invitation has already been used. Remove the account from the list above instead.',
    };
  }

  revalidatePath('/staff');
  return { ...INVITE_IDLE, message: 'Invitation withdrawn. The link no longer works.' };
}
