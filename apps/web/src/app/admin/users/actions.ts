'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth';

export async function createUser({
  full_name,
  email,
  password,
  role,
}: {
  full_name: string;
  email: string;
  password: string;
  role: 'owner' | 'staff';
}) {
  try {
    // Verify the caller is an owner
    const session = await requireUser();
    if (session.profile.role !== 'owner') {
      return {
        error: 'Only owners can create users',
        user: null,
      };
    }

    const admin = createAdminClient();

    // Create the auth user
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError || !created.user) {
      const message = createError?.message ?? '';
      if (/already|exists|registered/i.test(message)) {
        return {
          error: 'An account with that email already exists',
          user: null,
        };
      }
      return {
        error: `Failed to create user: ${message || 'unknown error'}`,
        user: null,
      };
    }

    // Create the profile
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .insert({
        id: created.user.id,
        full_name,
        role,
        onboarding_completed: role === 'owner', // Owners skip onboarding
      })
      .select()
      .single();

    if (profileError) {
      // Rollback the auth user
      await admin.auth.admin.deleteUser(created.user.id);
      return {
        error: `Failed to create profile: ${profileError.message}`,
        user: null,
      };
    }

    return {
      error: null,
      user: profile,
    };
  } catch (err) {
    const error = err as Error;
    return {
      error: error.message || 'Failed to create user',
      user: null,
    };
  }
}
