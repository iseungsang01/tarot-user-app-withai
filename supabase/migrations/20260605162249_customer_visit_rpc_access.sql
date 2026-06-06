-- Customer app uses opaque customer_sessions tokens, not Supabase Auth JWTs.
-- Keep visit_history table access behind SECURITY DEFINER RPCs so anon-key
-- clients do not need direct table privileges.

CREATE OR REPLACE FUNCTION public.get_my_visits(p_session_token text)
RETURNS TABLE (
  id integer,
  customer_id uuid,
  visit_date timestamptz
)
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

  RETURN QUERY
  SELECT vh.id, vh.customer_id, vh.visit_date
  FROM public.visit_history AS vh
  WHERE vh.customer_id = v_customer_id
    AND vh.is_deleted = false
    AND vh.is_hidden_by_customer = false
  ORDER BY vh.visit_date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_visit(p_session_token text, p_visit_id integer)
RETURNS TABLE (
  id integer,
  customer_id uuid,
  visit_date timestamptz
)
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

  RETURN QUERY
  SELECT vh.id, vh.customer_id, vh.visit_date
  FROM public.visit_history AS vh
  WHERE vh.id = p_visit_id
    AND vh.customer_id = v_customer_id
    AND vh.is_deleted = false
    AND vh.is_hidden_by_customer = false;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_visits(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_visit(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_visits(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_visit(text, integer) TO anon, authenticated;
