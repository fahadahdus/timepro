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
    // Get request body
    const requestBody = await req.json()
    const { startDateTime, endDateTime, destinationCountry } = requestBody

    // Validate required fields
    if (!startDateTime || !endDateTime || !destinationCountry) {
      throw new Error('Missing required fields: startDateTime, endDateTime, destinationCountry')
    }

    // Get Supabase service role key from environment
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://vvafqmzwunxjgacyagjd.supabase.co'
    
    // Get country rates from database
    const ratesResponse = await fetch(`${supabaseUrl}/rest/v1/country_daily_rates?select=*&country_code=eq.${destinationCountry}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      }
    })

    if (!ratesResponse.ok) {
      throw new Error('Failed to fetch country rates')
    }

    const countryRates = await ratesResponse.json()
    if (!countryRates.length) {
      throw new Error(`No rates found for country code: ${destinationCountry}`)
    }

    const rates = countryRates[0]
    const rateA = rates.rate_a // Partial day rate
    const rateB = rates.rate_b // Full day rate

    // Parse dates
    const start = new Date(startDateTime)
    const end = new Date(endDateTime)

    if (start >= end) {
      throw new Error('End date/time must be after start date/time')
    }

    // Calculate daily allowance using complex business logic
    const allowance = calculateDailyAllowance(start, end, rateA, rateB)

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          allowance: allowance.total,
          breakdown: allowance.breakdown,
          rates: {
            rateA: rateA,
            rateB: rateB,
            countryName: rates.country_name,
            countryCode: rates.country_code
          }
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in calculate-travel-allowance:', error)
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

// Complex daily allowance calculation logic
function calculateDailyAllowance(start, end, rateA, rateB) {
  let totalAllowance = 0
  const breakdown = []
  
  // Check if same day travel
  const isSameDay = start.toDateString() === end.toDateString()
  
  if (isSameDay) {
    // Same day travel - only first day rules apply
    const hoursAway = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    if (hoursAway >= 8) {
      totalAllowance += rateA
      breakdown.push({
        type: 'same_day',
        date: start.toDateString(),
        hours: Math.round(hoursAway * 100) / 100,
        rate: rateA,
        amount: rateA,
        description: `Same day travel (${Math.round(hoursAway * 100) / 100}h ≥ 8h)`
      })
    } else {
      breakdown.push({
        type: 'same_day',
        date: start.toDateString(),
        hours: Math.round(hoursAway * 100) / 100,
        rate: 0,
        amount: 0,
        description: `Same day travel (${Math.round(hoursAway * 100) / 100}h < 8h)`
      })
    }
  } else {
    // Multi-day travel
    
    // First day calculation
    const firstDayEnd = new Date(start)
    firstDayEnd.setHours(23, 59, 59, 999)
    const firstDayHours = (firstDayEnd.getTime() - start.getTime()) / (1000 * 60 * 60)
    
    if (firstDayHours >= 8) {
      totalAllowance += rateA
      breakdown.push({
        type: 'first_day',
        date: start.toDateString(),
        hours: Math.round(firstDayHours * 100) / 100,
        rate: rateA,
        amount: rateA,
        description: `First day (${Math.round(firstDayHours * 100) / 100}h ≥ 8h)`
      })
    } else {
      breakdown.push({
        type: 'first_day',
        date: start.toDateString(),
        hours: Math.round(firstDayHours * 100) / 100,
        rate: 0,
        amount: 0,
        description: `First day (${Math.round(firstDayHours * 100) / 100}h < 8h)`
      })
    }
    
    // Calculate intermediate full days
    const startNextDay = new Date(start)
    startNextDay.setDate(start.getDate() + 1)
    startNextDay.setHours(0, 0, 0, 0)
    
    const endPrevDay = new Date(end)
    endPrevDay.setDate(end.getDate() - 1)
    endPrevDay.setHours(23, 59, 59, 999)
    
    if (startNextDay <= endPrevDay) {
      const diffTime = endPrevDay.getTime() - startNextDay.getTime()
      const intermediateDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
      
      const intermediateAllowance = intermediateDays * rateB
      totalAllowance += intermediateAllowance
      
      for (let i = 0; i < intermediateDays; i++) {
        const intermediateDate = new Date(startNextDay)
        intermediateDate.setDate(startNextDay.getDate() + i)
        
        breakdown.push({
          type: 'full_day',
          date: intermediateDate.toDateString(),
          hours: 24,
          rate: rateB,
          amount: rateB,
          description: 'Full day'
        })
      }
    }
    
    // Last day calculation
    const lastDayStart = new Date(end)
    lastDayStart.setHours(0, 0, 0, 0)
    const lastDayHours = (end.getTime() - lastDayStart.getTime()) / (1000 * 60 * 60)
    
    if (lastDayHours >= 8) {
      totalAllowance += rateA
      breakdown.push({
        type: 'last_day',
        date: end.toDateString(),
        hours: Math.round(lastDayHours * 100) / 100,
        rate: rateA,
        amount: rateA,
        description: `Last day (${Math.round(lastDayHours * 100) / 100}h ≥ 8h)`
      })
    } else {
      breakdown.push({
        type: 'last_day',
        date: end.toDateString(),
        hours: Math.round(lastDayHours * 100) / 100,
        rate: 0,
        amount: 0,
        description: `Last day (${Math.round(lastDayHours * 100) / 100}h < 8h)`
      })
    }
  }
  
  return {
    total: Math.round(totalAllowance * 100) / 100,
    breakdown: breakdown
  }
}