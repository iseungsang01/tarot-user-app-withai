-- Fix the injected user, the UUID likely violates an auth schema constraint or relation
-- We will delete the injected user from auth.users completely.
-- Then we will create a procedure to sign up a user via standard auth function instead of manual insert.
-- Wait, auth.users functions are restricted. Better to just delete it.

DO $$
DECLARE
    v_user_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    DELETE FROM public.customers WHERE id = v_user_id;
    DELETE FROM auth.identities WHERE user_id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;
END $$;
