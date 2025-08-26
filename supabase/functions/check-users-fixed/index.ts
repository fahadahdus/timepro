// Edge Function: check-users-fixed
// This function checks the status of test user accounts in Supabase

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

    // Get all auth users
    const allAuthUsersResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
      }
    });

    const allAuthUsers = allAuthUsersResponse.ok ? (await allAuthUsersResponse.json()).users || [] : [];

    // Get all public users
    const allPublicUsersResponse = await fetch(`${supabaseUrl}/rest/v1/users?select=*`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
      }
    });

    const allPublicUsers = allPublicUsersResponse.ok ? await allPublicUsersResponse.json() : [];

    // Email addresses to check
    const emails = ['admin@timesheet.com', 'consultant@timesheet.com', 'test@timesheet.com'];
    const results = [];

    for (const email of emails) {
      // Find auth user by email
      const authUser = allAuthUsers.find(user => user.email === email);
      
      // Find public user by email
      const publicUser = allPublicUsers.find(user => user.email === email);

      results.push({
        email,
        auth_user_exists: !!authUser,
        auth_user: authUser ? {
          id: authUser.id,
          email: authUser.email,
          created_at: authUser.created_at,
          confirmed_at: authUser.email_confirmed_at
        } : null,
        public_user_exists: !!publicUser,
        public_user: publicUser,
        status: authUser && publicUser ? 'complete' : authUser ? 'auth_only' : publicUser ? 'public_only' : 'missing'
      });
    }

    return new Response(JSON.stringify({
      success: true,
      all_auth_users: allAuthUsers.map(u => ({ id: u.id, email: u.email })),
      all_public_users: allPublicUsers.map(u => ({ id: u.id, email: u.email })),
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
