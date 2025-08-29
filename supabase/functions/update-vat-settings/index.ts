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

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )
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
    
    // Get request body
    const requestBody = await req.json()
    const { expense_type, default_vat_rate, available_rates, description } = requestBody

    // Validate required fields
    if (!expense_type || default_vat_rate === undefined) {
      throw new Error('Missing required fields: expense_type, default_vat_rate')
    }

    // Validate VAT rate range
    if (default_vat_rate < 0 || default_vat_rate > 100) {
      throw new Error('VAT rate must be between 0 and 100')
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

    // Check if expense type is configurable
    const settingsResponse = await fetch(`${supabaseUrl}/rest/v1/vat_settings?select=is_configurable&expense_type=eq.${expense_type}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      }
    })

    if (!settingsResponse.ok) {
      throw new Error('Failed to check expense type configurability')
    }

    const settings = await settingsResponse.json()
    if (!settings.length) {
      throw new Error('Expense type not found')
    }

    if (!settings[0].is_configurable) {
      throw new Error('This expense type is not configurable')
    }

    // Update VAT settings
    const updateData: any = {
      default_vat_rate,
      updated_by: user.id
    }

    if (available_rates) {
      updateData.available_rates = JSON.stringify(available_rates)
    }

    if (description !== undefined) {
      updateData.description = description
    }

    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/vat_settings?expense_type=eq.${expense_type}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updateData)
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      console.error('Update error:', errorText)
      throw new Error(`Failed to update VAT settings: ${updateResponse.status}`)
    }

    const updatedSettings = await updateResponse.json()

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: updatedSettings[0],
        message: `VAT settings updated successfully for ${expense_type}` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in update-vat-settings:', error)
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