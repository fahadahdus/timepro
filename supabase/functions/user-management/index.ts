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
        const { action, email, password, full_name, role, hourly_rate, country_code } = await req.json();

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        if (action === 'create_user') {
            // Create auth user
            const createUserResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json',
                    'apikey': serviceRoleKey
                },
                body: JSON.stringify({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: {
                        full_name,
                        role
                    }
                })
            });

            if (!createUserResponse.ok) {
                const error = await createUserResponse.text();
                throw new Error(`Failed to create auth user: ${error}`);
            }

            const authUser = await createUserResponse.json();

            // Update or create user profile
            const upsertResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({
                    id: authUser.id,
                    email,
                    full_name,
                    role,
                    hourly_rate: hourly_rate || 0,
                    country_code: country_code || 'US',
                    is_active: true
                })
            });

            if (!upsertResponse.ok) {
                const error = await upsertResponse.text();
                throw new Error(`Failed to create user profile: ${error}`);
            }

            return new Response(JSON.stringify({
                success: true,
                user: authUser
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (action === 'list_users') {
            // List all users from our users table
            const usersResponse = await fetch(`${supabaseUrl}/rest/v1/users?select=*`, {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey
                }
            });

            if (!usersResponse.ok) {
                throw new Error('Failed to fetch users');
            }

            const users = await usersResponse.json();
            
            return new Response(JSON.stringify({
                success: true,
                users
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        throw new Error('Invalid action');

    } catch (error) {
        console.error('User management error:', error);

        const errorResponse = {
            error: {
                code: 'USER_MANAGEMENT_ERROR',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});