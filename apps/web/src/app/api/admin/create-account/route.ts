import { createAdminClient } from '@/lib/supabase/admin';

/**
 * ADMIN ONLY: Create an owner account directly
 * Usage: POST /api/admin/create-account
 * Body: { email, password, fullName, adminKey }
 */

const ADMIN_KEY = process.env.ADMIN_CREATE_KEY || 'admin-secret-key-12345';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, fullName, adminKey } = body;

    // Verify admin key
    if (adminKey !== ADMIN_KEY) {
      return Response.json(
        { error: 'Unauthorized: invalid admin key' },
        { status: 401 }
      );
    }

    // Validate inputs
    if (!email || !password || !fullName) {
      return Response.json(
        { error: 'Missing required fields: email, password, fullName' },
        { status: 400 }
      );
    }

    if (password.length < 12) {
      return Response.json(
        { error: 'Password must be at least 12 characters' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Create auth user
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError || !created.user) {
      const message = createError?.message ?? '';
      if (/already|exists|registered/i.test(message)) {
        return Response.json(
          { error: 'Account with that email already exists' },
          { status: 409 }
        );
      }
      return Response.json(
        { error: `Failed to create user: ${message}` },
        { status: 500 }
      );
    }

    // Create profile with owner role
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .insert({
        id: created.user.id,
        full_name: fullName,
        role: 'owner',
        onboarding_completed: true,
      })
      .select()
      .single();

    if (profileError) {
      // Rollback
      await admin.auth.admin.deleteUser(created.user.id);
      return Response.json(
        { error: `Failed to create profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        user: {
          id: created.user.id,
          email: created.user.email,
          fullName,
          role: 'owner',
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const error = err as Error;
    return Response.json(
      { error: error.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}
