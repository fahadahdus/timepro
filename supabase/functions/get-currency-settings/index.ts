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

        // Get the currently active currency
        const response = await fetch(`${supabaseUrl}/rest/v1/currency_settings?select=currency_code,currency_symbol,currency_name,decimal_places&is_active=eq.true`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch active currency: ${errorText}`);
        }

        const currencies = await response.json();

        if (!currencies || currencies.length === 0) {
            // Fallback to EUR if no active currency found
            return new Response(JSON.stringify({ 
                data: {
                    currency_code: 'EUR',
                    currency_symbol: '€',
                    currency_name: 'Euro',
                    decimal_places: 2
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const activeCurrency = currencies[0];

        return new Response(JSON.stringify({ 
            data: {
                currency_code: activeCurrency.currency_code,
                currency_symbol: activeCurrency.currency_symbol,
                currency_name: activeCurrency.currency_name,
                decimal_places: activeCurrency.decimal_places
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Get currency settings error:', error);

        const errorResponse = {
            error: {
                code: 'GET_CURRENCY_SETTINGS_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});