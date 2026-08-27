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
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  return <AdminUsersView users={users || []} />;
}
