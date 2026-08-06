'use server';

/**
 * Staff-side contract management.
 *
 * The share link is returned once, on send, and only its hash is stored — same
 * trade as galleries. Losing a link costs one re-send; storing it would mean a
 * database leak handed over every client's signing page.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { generateToken, hashToken } from '@/lib/crypto/share-token';
import { renderContract } from '@/lib/contracts/template';
import { friendlyDbError } from '@/lib/schema-errors';
import type { ShootType } from '@lensello/core';
import type { ContractAdminState } from './contract-state';
import { CONTRACT_ADMIN_IDLE } from './contract-state';

const gigIdSchema = z.string().uuid('Unknown gig.');

/**
 * Renders the standard terms for this gig, without saving anything.
 *
 * Separate from sending on purpose: a contract should be read by the person
 * whose business it binds before a client ever sees it.
 */
export async function draftContract(
  _previous: ContractAdminState,
  formData: FormData,
): Promise<ContractAdminState> {
  const { supabase } = await requireUser();

  const parsed = gigIdSchema.safeParse(formData.get('gigId'));
  if (!parsed.success) {
    return { ...CONTRACT_ADMIN_IDLE, error: 'Unknown gig.' };
  }

  const { data: gig } = await supabase
    .from('gigs')
    .select('id, title, type, starts_at, ends_at, location, price_cents, deposit_cents, client_id')
    .eq('id', parsed.data)
    .maybeSingle();

  if (!gig) return { ...CONTRACT_ADMIN_IDLE, error: 'That gig no longer exists.' };

  let clientName = 'the Client';
  if (gig.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', gig.client_id)
      .maybeSingle();
    if (client?.name) clientName = client.name;
  }

  const draft = renderContract({
    studioName: process.env.LENSELLO_STUDIO_NAME?.trim() || 'Lensello Photography',
    clientName,
    gigTitle: gig.title,
    gigType: gig.type as ShootType,
    startsAt: gig.starts_at,
    endsAt: gig.ends_at,
    location: gig.location,
    priceCents: gig.price_cents,
    depositCents: gig.deposit_cents,
  });

  return { ...CONTRACT_ADMIN_IDLE, draft };
}

const sendSchema = z.object({
  gigId: z.string().uuid('Unknown gig.'),
  body: z
    .string()
    .trim()
    .min(50, 'That agreement looks too short to send.')
    .max(50_000, 'That agreement is too long.'),
  title: z.string().trim().max(120).optional(),
  expiresInDays: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .refine(
      (value) => value === undefined || (Number.isInteger(value) && value > 0 && value <= 365),
      'Pick between 1 and 365 days.',
    ),
});

export async function sendContract(
  _previous: ContractAdminState,
  formData: FormData,
): Promise<ContractAdminState> {
  const { supabase, user } = await requireUser();

  const parsed = sendSchema.safeParse({
    gigId: formData.get('gigId'),
    body: formData.get('body'),
    title: formData.get('title') ?? undefined,
    expiresInDays: formData.get('expiresInDays') ?? undefined,
  });

  if (!parsed.success) {
    return {
      ...CONTRACT_ADMIN_IDLE,
      error: parsed.error.issues[0]?.message ?? 'Check the agreement.',
      draft: typeof formData.get('body') === 'string' ? String(formData.get('body')) : null,
    };
  }

  const input = parsed.data;
  const token = generateToken();

  const { error } = await supabase.from('contracts').insert({
    gig_id: input.gigId,
    token_hash: hashToken(token),
    // Whatever is in the box at this moment, verbatim. This is the copy the
    // client's acceptance will be recorded against.
    body: input.body,
    title: input.title || 'Photography agreement',
    status: 'sent',
    sent_at: new Date().toISOString(),
    expires_at: input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
      : null,
    created_by: user.id,
  });

  if (error) {
    return {
      ...CONTRACT_ADMIN_IDLE,
      error: friendlyDbError(error, 'The agreement could not be sent.'),
      draft: input.body,
    };
  }

  revalidatePath(`/gigs/${input.gigId}`);

  return {
    error: null,
    message: 'Agreement ready. Copy the link now — it cannot be shown again.',
    shareUrl: `/c/${token}`,
    draft: null,
  };
}

/**
 * Withdraws an agreement.
 *
 * An accepted contract cannot be voided: it is evidence of something that
 * happened, and making it disappear from the app would not make the agreement
 * not have been made. Superseding it means sending a new one.
 */
export async function voidContract(
  _previous: ContractAdminState,
  formData: FormData,
): Promise<ContractAdminState> {
  const { supabase } = await requireUser();

  const contractId = z.string().uuid().safeParse(formData.get('contractId'));
  if (!contractId.success) {
    return { ...CONTRACT_ADMIN_IDLE, error: 'Unknown agreement.' };
  }

  const { data: updated, error } = await supabase
    .from('contracts')
    .update({ status: 'void' })
    .eq('id', contractId.data)
    .neq('status', 'accepted')
    .select('gig_id')
    .maybeSingle();

  if (error) {
    return {
      ...CONTRACT_ADMIN_IDLE,
      error: friendlyDbError(error, 'The agreement could not be withdrawn.'),
    };
  }

  if (!updated) {
    return {
      ...CONTRACT_ADMIN_IDLE,
      error:
        'An accepted agreement cannot be withdrawn — it records something that happened. Send a replacement instead.',
    };
  }

  revalidatePath(`/gigs/${updated.gig_id}`);
  return { ...CONTRACT_ADMIN_IDLE, message: 'Agreement withdrawn. The link no longer works.' };
}
