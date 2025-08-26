-- User creation function for Super Admin
CREATE OR REPLACE FUNCTION create_user_account(
  user_email TEXT,
  user_password TEXT,
  user_full_name TEXT,
  user_role TEXT DEFAULT 'consultant',
  user_hourly_rate DECIMAL(10,2) DEFAULT 0,
  user_country_code TEXT DEFAULT 'US'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
  auth_user_id UUID;
  result JSON;
BEGIN
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM users WHERE email = user_email) THEN
    RETURN json_build_object('error', 'User already exists with this email');
  END IF;
  
  -- For demo purposes, we'll create a user record directly
  -- In production, this would integrate with Supabase Auth
  INSERT INTO users (
    email,
    full_name,
    role,
    hourly_rate,
    country_code,
    is_active
  ) VALUES (
    user_email,
    user_full_name,
    user_role,
    user_hourly_rate,
    user_country_code,
    true
  ) RETURNING id INTO new_user_id;
  
  result := json_build_object(
    'success', true,
    'user_id', new_user_id,
    'message', 'User created successfully (demo mode - password not stored)'
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$;