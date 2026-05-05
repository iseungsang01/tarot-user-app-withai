-- Inject a test user bypassing Supabase Auth rate limits
-- We create the user directly in auth.users and public.customers

DO $$
DECLARE
    v_test_phone text := '010-1234-5678';
    v_test_email text := '01012345678@tarot-app.com';
    v_test_password text := '123400'; -- Note: 1234 padded with 00 based on our authService logic
    v_user_id uuid := '00000000-0000-0000-0000-000000000001'::uuid; -- Fixed UUID for test user
    v_encrypted_pw text;
    v_customers_pw text;
BEGIN
    -- Delete existing test user if any
    DELETE FROM public.customers WHERE phone_number = v_test_phone;
    DELETE FROM auth.users WHERE email = v_test_email OR id = v_user_id;

    -- auth.users password needs to use specific pgcrypto format for Supabase
    -- The crypt() function with bf salt is standard for Supabase
    v_encrypted_pw := extensions.crypt(v_test_password, extensions.gen_salt('bf'));
    v_customers_pw := extensions.crypt(v_test_password, extensions.gen_salt('bf'));

    -- Insert into auth.users (Supabase Internal Auth)
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_test_email,
        v_encrypted_pw,
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        false
    );

    -- Insert into auth.identities
    INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        v_user_id::text,
        jsonb_build_object('sub', v_user_id::text, 'email', v_test_email),
        'email',
        now(),
        now()
    );

    -- Insert into public.customers (App Data)
    INSERT INTO public.customers (
        id,
        phone_number,
        password,
        nickname
    ) VALUES (
        v_user_id,
        v_test_phone,
        v_customers_pw,
        '테스트계정'
    );

END $$;
