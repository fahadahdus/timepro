// Edge Function: check-users
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

    // Email addresses to check
    const emails = ['admin@timesheet.com', 'consultant@timesheet.com'];
    const results = [];

    for (const email of emails) {
      // 1. Check auth.users table
      const authUserResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        }
      });

      let authUser = null;
      if (authUserResponse.ok) {
        const authData = await authUserResponse.json();
        if (authData.users && authData.users.length > 0) {
          authUser = {
            id: authData.users[0].id,
            email: authData.users[0].email,
            created_at: authData.users[0].created_at,
            confirmed_at: authData.users[0].email_confirmed_at
          };
        }
      }

      // 2. Check public.users table
      const publicUserResponse = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        }
      });

      let publicUser = null;
      if (publicUserResponse.ok) {
        const publicData = await publicUserResponse.json();
        if (publicData && publicData.length > 0) {
          publicUser = publicData[0];
        }
      }

      results.push({
        email,
        auth_user_exists: !!authUser,
        auth_user: authUser,
        public_user_exists: !!publicUser,
        public_user: publicUser,
        status: authUser && publicUser ? 'complete' : authUser ? 'auth_only' : publicUser ? 'public_only' : 'missing'
      });
    }

    return new Response(JSON.stringify({
      success: true,
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
