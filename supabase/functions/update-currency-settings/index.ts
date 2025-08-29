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
        const { currency_code } = await req.json();

        // Validate input
        if (!currency_code) {
            throw new Error('Currency code is required');
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
        const adminCheckResponse = await fetch(`${supabaseUrl}/rest/v1/users?select=role&id=eq.${userId}`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!adminCheckResponse.ok) {
            throw new Error('Failed to verify user role');
        }

        const userData = await adminCheckResponse.json();
        if (!userData || userData.length === 0 || userData[0].role !== 'super_admin') {
            throw new Error('Unauthorized: Admin access required');
        }

        // Verify the currency exists
        const currencyCheckResponse = await fetch(`${supabaseUrl}/rest/v1/currency_settings?select=id&currency_code=eq.${currency_code}`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!currencyCheckResponse.ok) {
            throw new Error('Failed to verify currency');
        }

        const currencies = await currencyCheckResponse.json();
        if (!currencies || currencies.length === 0) {
            throw new Error('Currency not found');
        }

        // Update the currency setting (trigger will handle deactivating others)
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/currency_settings?currency_code=eq.${currency_code}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                is_active: true,
                updated_at: new Date().toISOString(),
                updated_by: userId
            })
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Failed to update currency settings: ${errorText}`);
        }

        const updatedCurrency = await updateResponse.json();

        // Log the change for audit purposes
        console.log(`Admin ${userId} changed active currency to ${currency_code}`);

        return new Response(JSON.stringify({ 
            data: updatedCurrency[0],
            message: `Currency changed to ${currency_code} successfully`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Update currency settings error:', error);

        const errorResponse = {
            error: {
                code: 'UPDATE_CURRENCY_SETTINGS_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});