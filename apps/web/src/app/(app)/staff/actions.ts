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
