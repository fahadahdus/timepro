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

    // Parse query parameters
    const url = new URL(req.url)
    const userId = url.searchParams.get('user_id') || user.id
    const projectId = url.searchParams.get('project_id')
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')
    const expenseType = url.searchParams.get('expense_type')

    // Build query
    let query = supabaseClient
      .from('expense_entries')
      .select(`
        *,
        projects!fk_expense_project(
          name,
          code
        )
      `)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    // Apply filters
    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    if (dateFrom) {
      query = query.gte('date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('date', dateTo)
    }
    if (expenseType) {
      query = query.eq('expense_type', expenseType)
    }

    const { data: expenses, error: expensesError } = await query

    if (expensesError) {
      console.error('Expenses retrieval error:', expensesError)
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve expenses', details: expensesError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate totals
    const totals = expenses.reduce((acc, expense) => {
      acc.totalGross += expense.gross_amount
      acc.totalNet += expense.net_amount
      acc.totalVat += expense.vat_amount
      acc.count += 1
      return acc
    }, { totalGross: 0, totalNet: 0, totalVat: 0, count: 0 })

    // Round totals
    totals.totalGross = Math.round(totals.totalGross * 100) / 100
    totals.totalNet = Math.round(totals.totalNet * 100) / 100
    totals.totalVat = Math.round(totals.totalVat * 100) / 100

    return new Response(
      JSON.stringify({ 
        success: true, 
        expenses,
        totals
      }),
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
