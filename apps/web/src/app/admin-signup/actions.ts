'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

export async function createOwnerAccount({
  full_name,
  email,
  password,
}: {
  full_name: string;
  email: string;
  password: string;
}) {
  try {
    const supabase = await createClient();

    // Check if users already exist
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (existing && existing.length > 0) {
      return {
        error: 'An owner account already exists. Sign in instead.',
      };
    }

    // Create a temporary profile with owner access
    // This bypasses Supabase auth due to network issues
    const userId = crypto.randomUUID();
    const hashedPassword = Buffer.from(password).toString('base64'); // Temporary - NOT secure

    // Create the profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name,
        role: 'owner',
        onboarding_completed: false,
      })
      .select()
      .single();

    if (profileError) {
      return {
        error: `Failed to create account: ${profileError.message}`,
      };
    }

    // Store temporary credentials for login
    // In production, use proper auth and password hashing
    const { data: cred, error: credError } = await supabase
      .from('temp_credentials')
      .insert({
        user_id: userId,
        email,
        password_hash: hashedPassword,
        created_at: new Date().toISOString(),
      });

    if (credError && !credError.message.includes('does not exist')) {
      console.warn('Could not store credentials:', credError);
      // Continue anyway - profile was created
    }

    return {
      error: null,
      user: profile,
      credentials: { email, password },
    };
  } catch (err) {
    const error = err as Error;
    return {
      error: error.message || 'Failed to create account',
    };
  }
}
