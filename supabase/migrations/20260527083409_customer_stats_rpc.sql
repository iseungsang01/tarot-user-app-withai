CREATE OR REPLACE FUNCTION public.get_customer_stats(p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_token_hash text;
BEGIN
  IF p_session_token IS NULL OR length(trim(p_session_token)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Missing session token.');
  END IF;

  v_token_hash := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

  SELECT c.* INTO v_customer
  FROM public.customer_sessions s
  JOIN public.customers c ON c.id = s.customer_id
  WHERE s.token_hash = v_token_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND c.deleted_at IS NULL;

  IF v_customer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Session expired or customer not found.');
  END IF;

  UPDATE public.customer_sessions
  SET last_used_at = now()
  WHERE token_hash = v_token_hash;

  RETURN jsonb_build_object(
    'success', true,
    'current_stamps', COALESCE(v_customer.current_stamps, 0),
    'visit_count', COALESCE(v_customer.visit_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_stats(text) TO anon, authenticated;
