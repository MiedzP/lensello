const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lfhsuiwmtlhljrjsjvwg.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaHN1aXdtdGxobGpyanNqdndnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQ1MzM4OSwiZXhwIjoyMTAzMDI5Mzg5fQ.4ScuX6nCww-sZXv48GV02gq0mAiR-STYorE4-xPOdlU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createTestUser() {
  try {
    // Create auth user
    const { data: { user }, error: authError } = await supabase.auth.admin.createUser({
      email: 'test@lensello.com',
      password: 'LenselloTest123!',
      email_confirm: true,
      user_metadata: { full_name: 'Test User' }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return;
    }

    console.log('✓ Auth user created:', user.id);

    // Create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        full_name: 'Test User',
        role: 'staff'
      })
      .select();

    if (profileError) {
      console.error('Profile error:', profileError);
      return;
    }

    console.log('✓ Profile created');
    console.log('\n📧 Test Account Created!');
    console.log('Email: test@lensello.com');
    console.log('Password: LenselloTest123!');
  } catch (err) {
    console.error('Error:', err);
  }
}

createTestUser();
