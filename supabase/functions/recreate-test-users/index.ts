// Edge Function: recreate-test-users
// This function recreates test user accounts for the timesheet application

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    }

    // User data
    const users = [
      {
        email: 'admin@timesheet.com',
        password: 'Admin123!',
        name: 'System Administrator',
        role: 'super_admin',
        hourly_rate: 150
      },
      {
        email: 'consultant@timesheet.com',
        password: 'Consultant123!',
        name: 'John Consultant',
        role: 'consultant',
        hourly_rate: 100
      },
      {
        email: 'test@timesheet.com',
        password: 'Test123!',
        name: 'Test User',
        role: 'consultant',
        hourly_rate: 75
      }
    ];

    const results = [];

    // Step 1: Delete all test users first
    for (const user of users) {
      // Check if auth user exists and delete
      const authUserResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(user.email)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        }
      });

      if (authUserResponse.ok) {
        const userData = await authUserResponse.json();
        if (userData.users && userData.users.length > 0) {
          // Delete auth user
          await fetch(`${supabaseUrl}/auth/v1/admin/users/${userData.users[0].id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey,
            }
          });
        }
      }

      // Delete from public.users
      await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(user.email)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Prefer': 'return=minimal'
        }
      });
    }

    // Wait a moment for deletions to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Create new users
    for (const user of users) {
      // Create auth user
      const createAuthResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: { name: user.name }
        })
      });

      if (!createAuthResponse.ok) {
        const errorData = await createAuthResponse.text();
        results.push({
          email: user.email,
          status: 'error',
          stage: 'auth_creation',
          message: errorData
        });
        continue;
      }

      const authData = await createAuthResponse.json();
      const userId = authData.id;

      // Wait a moment for auth creation to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create public user
      const createPublicResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          id: userId,
          email: user.email,
          full_name: user.name,
          role: user.role,
          hourly_rate: user.hourly_rate,
          country_code: 'US',
          is_active: true
        })
      });

      if (!createPublicResponse.ok) {
        const errorData = await createPublicResponse.text();
        results.push({
          email: user.email,
          status: 'error',
          stage: 'public_user_creation',
          message: errorData
        });
        continue;
      }

      const publicData = await createPublicResponse.json();

      results.push({
        email: user.email,
        password: user.password,
        status: 'success',
        auth_id: userId,
        public_id: publicData[0]?.id || userId
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Test users recreated successfully',
      results
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
