const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) {
      throw new Error('Missing SUPABASE_URL environment variable')
    }
    
    // Verify user is admin
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseServiceKey
      }
    })

    if (!userResponse.ok) {
      throw new Error('Invalid authentication token')
    }

    const user = await userResponse.json()
    
    // Check if user has admin role
    const adminCheckResponse = await fetch(`${supabaseUrl}/rest/v1/users?select=role&id=eq.${user.id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      }
    })

    if (!adminCheckResponse.ok) {
      throw new Error('Failed to verify user role')
    }

    const userData = await adminCheckResponse.json()
    if (!userData || userData.length === 0 || userData[0].role !== 'super_admin') {
      throw new Error('Unauthorized: Admin access required')
    }

    // Get detailed VAT settings for admin interface
    const vatResponse = await fetch(`${supabaseUrl}/rest/v1/vat_settings?select=*,updated_by_user:users!vat_settings_updated_by_fkey(email)&order=expense_type.asc`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      }
    })

    if (!vatResponse.ok) {
      const errorText = await vatResponse.text()
      console.error('Database error:', errorText)
      throw new Error(`Database error: ${vatResponse.status}`)
    }

    const vatSettings = await vatResponse.json()

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: vatSettings 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in get-admin-vat-settings:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})