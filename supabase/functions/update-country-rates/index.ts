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
        const { countryId, rateA, rateB } = await req.json();

        // Validate input
        if (!countryId) {
            throw new Error('Country ID is required');
        }

        if (rateA === undefined || rateA === null || rateA < 0) {
            throw new Error('Valid rate A is required');
        }

        if (rateB === undefined || rateB === null || rateB < 0) {
            throw new Error('Valid rate B is required');
        }

        // Get user from auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('No authorization header provided');
        }

        const token = authHeader.replace('Bearer ', '');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        // Verify user authentication and get user info
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': serviceRoleKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid authentication token');
        }

        const userData = await userResponse.json();
        const userId = userData.id;

        // Check if user has admin role
        const adminCheckResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?select=role&id=eq.${userId}`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!adminCheckResponse.ok) {
            throw new Error('Failed to verify user role');
        }

        const profiles = await adminCheckResponse.json();
        if (!profiles || profiles.length === 0 || profiles[0].role !== 'admin') {
            throw new Error('Unauthorized: Admin access required');
        }

        // Update the country rates
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/country_daily_rates?id=eq.${countryId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                rate_a: rateA,
                rate_b: rateB,
                updated_at: new Date().toISOString(),
                updated_by: userId
            })
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Failed to update country rates: ${errorText}`);
        }

        const updatedRates = await updateResponse.json();

        // Log the change for audit purposes
        console.log(`Admin ${userId} updated country rates for country ID ${countryId}: Rate A: ${rateA}, Rate B: ${rateB}`);

        return new Response(JSON.stringify({ 
            data: updatedRates[0],
            message: 'Country rates updated successfully'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Update country rates error:', error);

        const errorResponse = {
            error: {
                code: 'UPDATE_COUNTRY_RATES_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});