// Admin Setup Script for PronoiaApp
// Run this after signing in to Google to grant admin privileges

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rjlzqlzuvvuowytnatng.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqbHpxbHp1dnZ1b3d5dG5hdG5nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjkwMDAyNSwiZXhwIjoyMDY4NDc2MDI1fQ.RNS__pcNO9w-x4o-M9ICpO6v26LDkAVsrM1mNRivJk4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupAdmin() {
  try {
    console.log('🔍 Checking existing users...');
    
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log(`📊 Found ${users.length} users in database:`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.google_id})`);
      console.log(`   Current role: ${user.preferences?.role || 'none'}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
      console.log('');
    });
    
    if (users.length === 0) {
      console.log('⚠️ No users found. Please sign in to Google first at localhost:3000');
      console.log('   1. Go to http://localhost:3000');
      console.log('   2. Sign in with Google');
      console.log('   3. Then run this script again');
      return;
    }
    
    // Automatically make the first user an admin
    const firstUser = users[0];
    console.log(`🎯 Making ${firstUser.email} an admin...`);
    
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        preferences: {
          ...firstUser.preferences,
          role: 'admin'
        }
      })
      .eq('id', firstUser.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Error updating user:', updateError);
      return;
    }
    
    console.log('✅ Success! Admin privileges granted to:', firstUser.email);
    console.log('🚀 You can now access the admin panel at: http://localhost:3000/admin');
    console.log('');
    console.log('🎨 Available admin features:');
    console.log('   • Template Builder: http://localhost:3000/admin/templates/builder');
    console.log('   • Template Management: http://localhost:3000/admin/templates');
    console.log('   • Admin Dashboard: http://localhost:3000/admin');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the setup
setupAdmin();