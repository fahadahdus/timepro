Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        // Get environment variables
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        // This endpoint is used by the expense modal to get country rates for calculation
        // It returns a simplified format optimized for frontend use
        const response = await fetch(`${supabaseUrl}/rest/v1/country_daily_rates?select=id,country_name,rate_a,rate_b&order=country_name.asc`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch country rates: ${errorText}`);
        }

        const countryRates = await response.json();

        // Transform data for easier frontend consumption
        const ratesForCalculation = countryRates.map((rate: any) => ({
            id: rate.id,
            country: rate.country_name,
            rateA: rate.rate_a,
            rateB: rate.rate_b
        }));

        return new Response(JSON.stringify({ 
            data: ratesForCalculation 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Get country rates for calculation error:', error);

        const errorResponse = {
            error: {
                code: 'GET_COUNTRY_RATES_CALCULATION_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});