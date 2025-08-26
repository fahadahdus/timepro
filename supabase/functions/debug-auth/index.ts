import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('--- DEBUG AUTH ---')
    console.log('Authorization header:', req.headers.get('Authorization'))
    console.log('apikey header:', req.headers.get('apikey'))
    console.log('x-client-info header:', req.headers.get('x-client-info'))
    
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('ERROR: No Authorization header found')
      return new Response(
        JSON.stringify({ error: 'No Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Try creating supabase client with user token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Test getting user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    console.log('User lookup result:', { user: user?.id, error: userError })
    
    if (userError || !user) {
      console.log('ERROR: User authentication failed', userError)
      return new Response(
        JSON.stringify({ 
          error: 'User authentication failed',
          details: userError,
          authHeaderPresent: !!authHeader,
          authHeaderLength: authHeader?.length
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Test database access with RLS
    const { data: weeks, error: weekError } = await supabaseClient
      .from('weeks')
      .select('*')
      .limit(1)
    
    console.log('Database access result:', { weekCount: weeks?.length, error: weekError })
    
    return new Response(
      JSON.stringify({ 
        success: true,
        user: { id: user.id, email: user.email },
        dbAccess: !weekError,
        weekCount: weeks?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('DEBUG ERROR:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
