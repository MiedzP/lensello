'use server';

/**
 * Staff Server Actions.
 *
 * Removal is owner-only, and that check happens here rather than in the UI.
 * Server Actions are reachable by direct POST, so a hidden button proves
 * nothing about who can invoke one.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { failed, ok, type ActionState } from '@/lib/staff/action-state';
import { recordAudit } from '@/lib/privacy/audit';
import type { CreateAccountState } from './account-state';

const removeSchema = z.object({
  accountId: z.string().uuid('Unknown account.'),
});

export async function removeAccount(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, profile } = await requireUser();

  if (profile.role !== 'owner') {
    return failed('Only an owner can remove an account.');
  }

  const parsed = removeSchema.safeParse({ accountId: formData.get('accountId') });
  if (!parsed.success) return failed('Unknown account.');
  const { accountId } = parsed.data;

  // Removing yourself would end the session mid-request and, if you are the
  // only owner, leave nobody able to administer the workspace. Demoting or
  // deleting your own account is a deliberate database action.
  if (accountId === user.id) {
    return failed('You cannot remove your own account.');
  }

  const admin = createAdminClient();

  // Deleting the auth user is the whole operation: profiles.id references
  // auth.users on delete cascade, so the profile row goes with it. Deleting
  // the profile alone would leave an account that can still sign in.
  const { error } = await admin.auth.admin.deleteUser(accountId);

  if (error) {
    return failed(`The account could not be removed: ${error.message}`);
  }

  revalidatePath('/staff');
  return ok('Account removed.');
}

// --- creating an account directly ----------------------------------------

/** Same floor as every other route in: an account reads the whole client book. */
const MIN_PASSWORD_LENGTH = 12;

const createAccountSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter their name.').max(120, 'That name is too long.'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    .max(72, 'Passwords are limited to 72 characters.'),
});

/**
 * Creates an account outright, without an invitation.
 *
 * The other two routes both require something from the other person: `/signup`
 * needs them to have the shared code, an invitation needs them to open a link
 * and choose a password. Neither helps when you simply want three accounts to
 * exist right now — for staff who are not at a keyboard, or to set the studio
 * up before anyone joins.
 *
 * The trade is that you choose their password and therefore know it, which an
 * invitation avoids. Tell them to change it, and prefer an invitation when the
 * person is available.
 */
export async function createAccountAction(
  _previous: CreateAccountState,
  formData: FormData,
): Promise<CreateAccountState> {
  const { supabase, user, profile } = await requireUser();

  if (profile.role !== 'owner') {
    return { error: 'Only an owner can create accounts.', message: null };
  }

  const parsed = createAccountSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check those details.', message: null };
  }

  const email = parsed.data.email.toLowerCase();
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    // No transactional mail is wired up, so a confirmation link would never
    // arrive and the account would be stranded.
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });

  if (createError || !created.user) {
    const message = createError?.message ?? '';
    if (/already|exists|registered/i.test(message)) {
      return { error: `${email} already has an account.`, message: null };
    }
    return { error: `The account could not be created: ${message || 'unknown error.'}`, message: null };
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    full_name: parsed.data.fullName,
    // Never 'owner'. Elevating an account stays a deliberate change in the
    // database, not something a form can grant.
    role: 'staff',
  });

  if (profileError) {
    // Roll back, or the address is burned: it can sign in, see nothing, and
    // cannot be used to try again.
    await admin.auth.admin.deleteUser(created.user.id);
    return {
      error: `The account could not be provisioned: ${profileError.message}`,
      message: null,
    };
  }

  await recordAudit(
    supabase,
    { id: user.id, email: user.email },
    {
      action: 'account.created',
      subjectType: 'account',
      subjectId: created.user.id,
      detail: { email, role: 'staff' },
    },
  );

  revalidatePath('/staff');
  return { error: null, message: `${email} can now sign in. Tell them to change the password.` };
}
