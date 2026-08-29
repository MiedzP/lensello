/**
 * Reads for the staff roster.
 *
 * The roster spans two schemas. `public.profiles` holds the name and role and
 * is readable by any staff session under `profiles_select_staff`. The email
 * address and last sign-in live in `auth.users`, which has no policy surface at
 * all, so those fields require the service-role client — there is no session in
 * which a normal user can read them.
 *
 * The two can disagree, and the disagreement is worth showing rather than
 * hiding: an auth user with no profile can sign in and see nothing, which is a
 * confusing state to debug from the outside.
 */

import type { Session } from '@/lib/auth';
import type { Tables } from '@/lib/db.types';
import type { createAdminClient } from '@/lib/supabase/admin';
import { asStaffRole } from '@/lib/validators';

type Supabase = Session['supabase'];
type Admin = ReturnType<typeof createAdminClient>;

export interface StaffMember {
  id: string;
  fullName: string;
  email: string | null;
  role: 'owner' | 'staff' | null;
  /** Null when there is no profile row — the account is not provisioned. */
  addedAt: string | null;
  lastSignInAt: string | null;
  /** False when an auth user exists with no matching profile row. */
  isProvisioned: boolean;
}

/** Defensive ceiling. A studio roster is a handful of people, not thousands. */
const MAX_PAGES = 5;
const PER_PAGE = 200;

interface AuthUserSummary {
  email: string | null;
  lastSignInAt: string | null;
  createdAt: string | null;
}

async function listAuthUsers(admin: Admin): Promise<Map<string, AuthUserSummary>> {
  const users = new Map<string, AuthUserSummary>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });

    if (error) {
      throw new Error(`Could not read the account list: ${error.message}`);
    }

    for (const user of data.users) {
      users.set(user.id, {
        email: user.email ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        createdAt: user.created_at ?? null,
      });
    }

    if (data.users.length < PER_PAGE) break;
  }

  return users;
}

export async function listStaff(
  supabase: Supabase,
  admin: Admin,
): Promise<StaffMember[]> {
  const [{ data: profiles, error }, authUsers] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    listAuthUsers(admin),
  ]);

  if (error) {
    throw new Error(`Could not read the staff roster: ${error.message}`);
  }

  const rows: StaffMember[] = (profiles ?? []).map((profile: Tables<'profiles'>) => {
    const authUser = authUsers.get(profile.id);
    return {
      id: profile.id,
      fullName: profile.full_name.trim() || 'Unnamed',
      email: authUser?.email ?? null,
      role: asStaffRole(profile.role, null as any),
      addedAt: profile.created_at,
      lastSignInAt: authUser?.lastSignInAt ?? null,
      isProvisioned: true,
    };
  });

  // Auth users with no profile. They can sign in and reach nothing, so they are
  // listed for what they are rather than omitted.
  const provisioned = new Set(rows.map((row) => row.id));
  for (const [id, authUser] of authUsers) {
    if (provisioned.has(id)) continue;
    rows.push({
      id,
      fullName: authUser.email ?? 'Unknown account',
      email: authUser.email,
      role: null,
      addedAt: authUser.createdAt,
      lastSignInAt: authUser.lastSignInAt,
      isProvisioned: false,
    });
  }

  // Owners first, then by name — the roster reads as a hierarchy, not an
  // insertion log.
  return rows.sort((a, b) => {
    if (a.role !== b.role) {
      if (a.role === 'owner') return -1;
      if (b.role === 'owner') return 1;
      if (a.role === null) return 1;
      if (b.role === null) return -1;
    }
    return a.fullName.localeCompare(b.fullName);
  });
}
