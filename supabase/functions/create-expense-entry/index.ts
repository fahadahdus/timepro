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
    const expenseData = await req.json()
    
    if (!expenseData) {
      return new Response(
        JSON.stringify({ error: 'Missing expense data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate required fields
    const requiredFields = ['project_id', 'expense_type', 'date', 'gross_amount', 'vat_percentage']
    for (const field of requiredFields) {
      if (expenseData[field] === undefined || expenseData[field] === null || expenseData[field] === '') {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Validate expense type
    const validExpenseTypes = [
      'train', 'taxi', 'flight', 'rental_car', 'fuel',
      'parking', 'onpv', 'hospitality', 'hotel', 'car', 'others'
    ]
    if (!validExpenseTypes.includes(expenseData.expense_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid expense type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Special validation for car expenses
    if (expenseData.expense_type === 'car') {
      if (!expenseData.distance_km || !expenseData.rate_per_km) {
        return new Response(
          JSON.stringify({ error: 'Car expenses require distance_km and rate_per_km' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (expenseData.vat_percentage !== 0) {
        return new Response(
          JSON.stringify({ error: 'Car expenses must have 0% VAT' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const validRates = [0.7, 0.5, 0.3]
      if (!validRates.includes(expenseData.rate_per_km)) {
        return new Response(
          JSON.stringify({ error: 'Invalid rate per km. Must be 0.7, 0.5, or 0.3' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Calculate VAT and net amounts
    const grossAmount = parseFloat(expenseData.gross_amount)
    const vatPercentage = parseFloat(expenseData.vat_percentage)
    const netAmount = grossAmount / (1 + vatPercentage / 100)
    const vatAmount = grossAmount - netAmount

    // Prepare expense entry data
    const expenseEntry = {
      user_id: user.id,
      project_id: expenseData.project_id,
      date: expenseData.date,
      expense_type: expenseData.expense_type,
      description: expenseData.description || null,
      gross_amount: Math.round(grossAmount * 100) / 100,
      vat_percentage: Math.round(vatPercentage * 100) / 100,
      vat_amount: Math.round(vatAmount * 100) / 100,
      net_amount: Math.round(netAmount * 100) / 100,
      distance_km: expenseData.distance_km ? parseFloat(expenseData.distance_km) : null,
      rate_per_km: expenseData.rate_per_km ? parseFloat(expenseData.rate_per_km) : null,
      receipt_uploaded: false
    }

    // Create the expense entry
    const { data: createdExpense, error: expenseError } = await supabaseClient
      .from('expense_entries')
      .insert(expenseEntry)
      .select()
      .single()

    if (expenseError) {
      console.error('Expense creation error:', expenseError)
      return new Response(
        JSON.stringify({ error: 'Failed to create expense entry', details: expenseError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, expense: createdExpense }),
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
