-- Customer-side "delete" is a drawer/history hide flag, not an admin delete.
-- Execute through a SECURITY DEFINER RPC because the customer app authenticates
-- with opaque customer_sessions tokens rather than Supabase Auth JWTs.

CREATE OR REPLACE FUNCTION public.hide_my_visit(p_session_token text, p_visit_id integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000';
  END IF;

  UPDATE public.visit_history AS vh
  SET is_hidden_by_customer = true
  WHERE vh.id = p_visit_id
    AND vh.customer_id = v_customer_id
    AND vh.is_deleted = false
    AND vh.is_hidden_by_customer = false;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.hide_my_visit(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hide_my_visit(text, integer) TO anon, authenticated;
