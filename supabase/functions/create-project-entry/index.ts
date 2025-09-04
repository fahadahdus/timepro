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
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header missing' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract the JWT token from the Bearer header
    const token = authHeader.replace('Bearer ', '')

    // Create authenticated Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Set the auth token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - please sign in again', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Authenticated user:', user.id, user.email)

    // Create a new client instance with the user's session for database operations
    const authenticatedClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Parse request body
    const { date, projectData } = await req.json()
    
    if (!date || !projectData) {
      return new Response(
        JSON.stringify({ error: 'Missing date or project data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Start a transaction-like operation
    // First, ensure we have a week entry
    const weekStart = new Date(date)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Get Monday
    const weekStartStr = weekStart.toISOString().split('T')[0]

    let { data: week, error: weekError } = await authenticatedClient
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
      const { data: newWeek, error: createWeekError } = await authenticatedClient
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
    let { data: dayEntry, error: dayError } = await authenticatedClient
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
      const { data: newDayEntry, error: createDayError } = await authenticatedClient
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

    // Create the project entry
    const { data: projectEntry, error: projectError } = await authenticatedClient
      .from('project_entries')
      .insert({
        day_entry_id: dayEntry.id,
        project_id: projectData.project_id,
        location: projectData.location,
        man_days: projectData.man_days,
        description: projectData.description,
        travel_chargeable: projectData.travel_chargeable
      })
      .select()
      .single()

    if (projectError) {
      console.error('Project entry creation error:', projectError)
      return new Response(
        JSON.stringify({ error: 'Failed to create project entry', details: projectError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, projectEntry }),
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