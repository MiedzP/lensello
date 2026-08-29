import { redirect } from 'next/navigation';
import { requireUserOrRedirect } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import AdminUsersView from './components/admin-users-view';

export const metadata = {
  title: 'User Management - Lensello Admin',
};

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const session = await requireUserOrRedirect();

  // Check if user is owner (only owners can manage users)
  if (session.profile.role !== 'owner') {
    redirect('/dashboard');
  }

  // Fetch all users
  const { data: rows } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  // Map to User type - profiles table doesn't have email column, so we use empty string as placeholder
  interface User {
    id: string;
    full_name: string;
    email: string;
    role: 'owner' | 'staff';
    created_at: string;
    onboarding_completed: boolean;
  }

  const users: User[] = (rows || []).map((row) => ({
    id: row.id,
    full_name: row.full_name,
    email: '', // profiles table doesn't have email column
    role: row.role as 'owner' | 'staff',
    created_at: row.created_at,
    onboarding_completed: row.onboarding_completed,
  }));

  return <AdminUsersView users={users} />;
}
