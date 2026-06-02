-- Remove legacy password RPC overloads that make PostgREST unable to choose
-- between text and uuid signatures for supabase.rpc('verify_password', ...).
DROP FUNCTION IF EXISTS public.verify_password(text, text);
DROP FUNCTION IF EXISTS public.update_customer_password(text, text);
