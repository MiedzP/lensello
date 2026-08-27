import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pzavguehexserzibscer.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6YXZndWVoZXhzZXJ6aWJzY2VyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQ5NTk4MywiZXhwIjoyMTAxMDcxOTgzfQ.-U7HqZ5vgjCjsoMSf1LjDukgIPn2hniOIJhPDLArsco';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createOwnerAccount() {
  try {
    const email = 'michael.pagano@xerensys.ai';
    const password = 'Lensello2026';
    const fullName = 'Michael Pagano';

    console.log('Creating owner account...\n');
    console.log(`Email: ${email}`);
    console.log(`Name: ${fullName}\n`);

    // Create auth user
    console.log('1. Creating auth user...');
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      console.error('❌ Error creating auth user:', createError.message);
      process.exit(1);
    }

    const userId = created.user.id;
    console.log(`   ✓ Auth user created: ${userId}\n`);

    // Create profile with owner role
    console.log('2. Creating profile with owner role...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: fullName,
        role: 'owner',
        onboarding_completed: true,
      })
      .select()
      .single();

    if (profileError) {
      console.error('❌ Error creating profile:', profileError.message);
      // Rollback auth user
      await supabase.auth.admin.deleteUser(userId);
      process.exit(1);
    }

    console.log(`   ✓ Profile created with owner role\n`);

    // Verify
    console.log('3. Verifying account...');
    const { data: verified, error: verifyError } = await supabase
      .from('profiles')
      .select('id, full_name, role, onboarding_completed')
      .eq('id', userId)
      .single();

    if (verifyError) {
      console.error('❌ Error verifying:', verifyError.message);
      process.exit(1);
    }

    console.log('   ✓ Account verified\n');

    console.log('✅ SUCCESS! Your account is ready!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Login Details:');
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Role:     ${verified.role}`);
    console.log(`  User ID:  ${userId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Next: Go to https://lensello-web-kappa.vercel.app/login and sign in\n');

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

createOwnerAccount();
