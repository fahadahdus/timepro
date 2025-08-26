// Edge Function: create-test-users
// This function creates test user accounts for the timesheet application

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

    // Admin user data
    const adminEmail = 'admin@timesheet.com';
    const adminPassword = 'Admin123!';
    const adminName = 'System Administrator';

    // Consultant user data
    const consultantEmail = 'consultant@timesheet.com';
    const consultantPassword = 'Consultant123!';
    const consultantName = 'John Consultant';

    // User records for processing
    const users = [
      { email: adminEmail, password: adminPassword, name: adminName, role: 'super_admin', hourly_rate: 150 },
      { email: consultantEmail, password: consultantPassword, name: consultantName, role: 'consultant', hourly_rate: 100 }
    ];

    const results = [];

    for (const userData of users) {
      // Step 1: Check if auth user exists and delete if necessary
      const authUserCheckResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(userData.email)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        }
      });

      if (authUserCheckResponse.ok) {
        const usersData = await authUserCheckResponse.json();
        if (usersData && usersData.users && usersData.users.length > 0) {
          const userId = usersData.users[0].id;
          
          // Delete from auth.users
          await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey,
            }
          });
        }
      }

      // Step 2: Check and delete from public.users if exists
      await fetch(`${supabaseUrl}/rest/v1/users`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ email: `eq.${userData.email}` })
      });

      // Step 3: Create new auth user
      const createAuthUserResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          email_confirm: true,
          user_metadata: { name: userData.name }
        })
      });

      if (!createAuthUserResponse.ok) {
        const errorData = await createAuthUserResponse.text();
        results.push({ 
          email: userData.email, 
          status: 'error', 
          message: `Auth user creation failed: ${errorData}` 
        });
        continue;
      }

      const authUserData = await createAuthUserResponse.json();
      const userId = authUserData.id;

      // Step 4: Create user in public.users table
      const userInsertResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          id: userId,
          email: userData.email,
          full_name: userData.name,
          role: userData.role,
          hourly_rate: userData.hourly_rate,
          country_code: 'US',
          is_active: true
        })
      });

      if (!userInsertResponse.ok) {
        const errorData = await userInsertResponse.text();
        results.push({ 
          email: userData.email, 
          status: 'error', 
          message: `User record creation failed: ${errorData}` 
        });
        continue;
      }

      results.push({
        email: userData.email,
        password: userData.password,
        status: 'success',
        role: userData.role
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Test users operation completed',
      results: results
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
