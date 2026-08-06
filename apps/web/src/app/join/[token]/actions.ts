'use server';

/**
 * Redeeming an invitation.
 *
 * The unauthenticated counterpart to `/signup`, and the safer one: the caller
 * presents a single-use token issued to them rather than a shared code that
 * everybody who ever joined also knows.
 *
 * The invite is re-resolved and re-checked here, never trusted from the page
 * that rendered the form — that page's state is minutes old by the time
 * somebody finishes typing, and the invite may have been revoked in between.
 */

import { timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { resolveInvite } from '@/lib/invites/queries';

export interface JoinState {
  error: string | null;
}

export const JOIN_IDLE: JoinState = { error: null };

/** Same floor as /signup: an account reads the entire client book. */
const MIN_PASSWORD_LENGTH = 12;

const schema = z.object({
  token: z.string().trim().min(20).max(200),
  fullName: z.string().trim().min(1, 'Enter your name.').max(120),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(72, 'Passwords are limited to 72 characters.'),
});

/** Constant time, so a locked invite cannot have its address guessed. */
function sameAddress(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function acceptInvite(
  _previous: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const parsed = schema.safeParse({
    token: formData.get('token'),
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details.' };
  }

  const admin = createAdminClient();
  const resolved = await resolveInvite(admin, parsed.data.token);

  if (!resolved) return { error: 'That invitation could not be found.' };

  if (resolved.problem === 'revoked') {
    return { error: 'This invitation has been withdrawn. Ask the studio for a new one.' };
  }
  if (resolved.problem === 'used') {
    return { error: 'This invitation has already been used. Sign in instead.' };
  }
  if (resolved.problem === 'expired') {
    return { error: 'This invitation has expired. Ask the studio for a new one.' };
  }

  const email = parsed.data.email.toLowerCase();

  // A locked invite only works for its address, so forwarding the link does
  // not hand access to whoever it was forwarded to.
  if (resolved.invite.email && !sameAddress(email, resolved.invite.email)) {
    return { error: `This invitation is for ${resolved.invite.email}.` };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    // No transactional mail is wired up, so a confirmation link would never
    // arrive and the account would be stranded. The invitation itself is the
    // proof that this address was expected.
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });

  if (createError || !created.user) {
    const message = createError?.message ?? '';
    if (/already|exists|registered/i.test(message)) {
      return { error: 'An account with that email already exists. Sign in instead.' };
    }
    return { error: `The account could not be created: ${message || 'unknown error.'}` };
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    full_name: parsed.data.fullName,
    role: resolved.invite.role,
  });

  if (profileError) {
    // Roll back, or the address is burned: it can sign in, see nothing, and
    // cannot be used to try again.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: `The account could not be provisioned: ${profileError.message}` };
  }

  // Marked used only now, and guarded on it still being unused, so two people
  // opening the same link cannot both get through — Postgres decides, not a
  // check-then-write both could pass.
  const { data: claimed } = await admin
    .from('invites')
    .update({ accepted_at: new Date().toISOString(), accepted_by: created.user.id })
    .eq('id', resolved.invite.id)
    .is('accepted_at', null)
    .select('id')
    .maybeSingle();

  if (!claimed) {
    // Lost the race. Undo rather than leave an account created from an
    // invitation somebody else consumed.
    await admin.from('profiles').delete().eq('id', created.user.id);
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: 'This invitation has just been used by someone else.' };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (signInError) redirect('/login');
  redirect('/');
}
