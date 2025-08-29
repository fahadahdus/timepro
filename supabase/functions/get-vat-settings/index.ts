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
    // Get Supabase service role key from environment
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://vvafqmzwunxjgacyagjd.supabase.co'
    
    // Get VAT settings from database
    const response = await fetch(`${supabaseUrl}/rest/v1/vat_settings?select=*&order=expense_type.asc`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Database error:', errorText)
      throw new Error(`Database error: ${response.status}`)
    }

    const vatSettings = await response.json()

    // Transform data for easier consumption by frontend
    const vatConfig: Record<string, any> = {}
    
    for (const setting of vatSettings) {
      vatConfig[setting.expense_type] = {
        defaultVat: setting.default_vat_rate,
        availableRates: setting.available_rates,
        isConfigurable: setting.is_configurable,
        description: setting.description
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: vatConfig 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in get-vat-settings:', error)
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