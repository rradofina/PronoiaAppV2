import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase/client';

// SECURITY: This is a one-time setup endpoint for production
// After granting admin access, this endpoint should be removed or secured

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Security: Only allow in development or with specific production override
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_ADMIN_SETUP) {
    return res.status(404).json({ error: 'Endpoint not available' });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, setupKey } = req.body;

    // Basic security check - require a setup key
    const expectedSetupKey = process.env.ADMIN_SETUP_KEY;
    if (!expectedSetupKey) {
      console.error('ADMIN_SETUP_KEY environment variable is not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    if (setupKey !== expectedSetupKey) {
      return res.status(401).json({ error: 'Invalid setup key' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (process.env.NODE_ENV === 'development') console.log('🔍 Admin Setup API: Looking for user with email:', email);

    // Find user by email
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);

    if (usersError) {
      console.error('❌ Error fetching user:', usersError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ 
        error: 'User not found', 
        message: 'Please sign in to Google first, then try again' 
      });
    }

    const user = users[0];
    if (process.env.NODE_ENV === 'development') console.log('✅ Found user:', user.email);

    // Update user to admin
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        preferences: {
          ...user.preferences,
          role: 'admin'
        }
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating user:', updateError);
      return res.status(500).json({ error: 'Failed to grant admin privileges' });
    }

    if (process.env.NODE_ENV === 'development') console.log('🎉 Admin privileges granted to:', user.email);

    return res.status(200).json({
      success: true,
      message: 'Admin privileges granted successfully',
      user: {
        email: updatedUser.email,
        role: updatedUser.preferences?.role,
      },
      adminAccess: {
        dashboard: '/admin',
        templateBuilder: '/admin/templates/builder',
        templateManagement: '/admin/templates'
      }
    });

  } catch (error) {
    console.error('💥 Admin setup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}