const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lfhsuiwmtlhljrjsjvwg.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaHN1aXdtdGxobGpyanNqdndnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQ1MzM4OSwiZXhwIjoyMTAzMDI5Mzg5fQ.4ScuX6nCww-sZXv48GV02gq0mAiR-STYorE4-xPOdlU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function resetTestUser() {
  try {
    // First, find the user by email
    const { data, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }

    const users = data?.users || [];
    const testUser = users.find(u => u.email === 'test@lensello.com');
    if (testUser) {
      console.log('Found test user, deleting:', testUser.id);
      const { error: deleteError } = await supabase.auth.admin.deleteUser(testUser.id);
      if (deleteError) {
        console.error('Error deleting user:', deleteError);
        return;
      }
      console.log('✓ User deleted');
    }

    // Create fresh auth user
    const { data: created, error: authError } = await supabase.auth.admin.createUser({
      email: 'test@lensello.com',
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Test User' }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return;
    }

    console.log('✓ Auth user created:', created.user.id);

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: created.user.id,
        full_name: 'Test User',
        role: 'staff'
      })
      .select();

    if (profileError) {
      console.error('Profile error:', profileError);
      return;
    }

    console.log('✓ Profile created');
    console.log('\n📧 Test Account Ready!');
    console.log('Email: test@lensello.com');
    console.log('Password: TestPassword123!');
  } catch (err) {
    console.error('Error:', err);
  }
}

resetTestUser();
