import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create authenticated Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    )

    // Get the current authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { date, costData } = await req.json()
    
    if (!date || !costData) {
      return new Response(
        JSON.stringify({ error: 'Missing date or cost data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Start a transaction-like operation
    // First, ensure we have a week entry
    const weekStart = new Date(date)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Get Monday
    const weekStartStr = weekStart.toISOString().split('T')[0]

    let { data: week, error: weekError } = await supabaseClient
      .from('weeks')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', weekStartStr)
      .maybeSingle()

    if (weekError) {
      console.error('Week lookup error:', weekError)
      return new Response(
        JSON.stringify({ error: 'Failed to lookup week' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create week if it doesn't exist
    if (!week) {
      const { data: newWeek, error: createWeekError } = await supabaseClient
        .from('weeks')
        .insert({
          user_id: user.id,
          week_start: weekStartStr,
          status: 'draft'
        })
        .select()
        .single()
      
      if (createWeekError) {
        console.error('Week creation error:', createWeekError)
        return new Response(
          JSON.stringify({ error: 'Failed to create week' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      week = newWeek
    }

    // Ensure we have a day entry
    let { data: dayEntry, error: dayError } = await supabaseClient
      .from('day_entries')
      .select('*')
      .eq('week_id', week.id)
      .eq('date', date)
      .maybeSingle()

    if (dayError) {
      console.error('Day entry lookup error:', dayError)
      return new Response(
        JSON.stringify({ error: 'Failed to lookup day entry' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create day entry if it doesn't exist
    if (!dayEntry) {
      const { data: newDayEntry, error: createDayError } = await supabaseClient
        .from('day_entries')
        .insert({
          week_id: week.id,
          date: date,
          status: 'active',
          allowance_amount: 0
        })
        .select()
        .single()
      
      if (createDayError) {
        console.error('Day entry creation error:', createDayError)
        return new Response(
          JSON.stringify({ error: 'Failed to create day entry' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      dayEntry = newDayEntry
    }

    // Calculate net amount
    const net_amount = costData.gross_amount / (1 + costData.vat_percentage / 100)

    // Create the cost entry
    const { data: costEntry, error: costError } = await supabaseClient
      .from('cost_entries')
      .insert({
        day_entry_id: dayEntry.id,
        type: costData.type,
        distance_km: costData.distance_km || null,
        gross_amount: costData.gross_amount,
        net_amount: net_amount,
        vat_percentage: costData.vat_percentage,
        chargeable: costData.chargeable,
        notes: costData.notes || null,
        invoiced: false
      })
      .select()
      .single()

    if (costError) {
      console.error('Cost entry creation error:', costError)
      return new Response(
        JSON.stringify({ error: 'Failed to create cost entry', details: costError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, costEntry }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})