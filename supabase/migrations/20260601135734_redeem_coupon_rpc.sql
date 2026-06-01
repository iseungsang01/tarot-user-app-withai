DROP FUNCTION IF EXISTS public.use_my_coupon_with_admin_password(text, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.redeem_coupon(integer, text, text) CASCADE;

CREATE OR REPLACE FUNCTION public.redeem_coupon(
  p_coupon_id integer,
  p_admin_password text,
  p_session_token text
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_hashed_password text;
  v_coupon public.coupon_history%ROWTYPE;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RETURN QUERY SELECT false, 'invalid_session'::text;
    RETURN;
  END IF;

  SELECT value INTO v_hashed_password
  FROM public.app_configs
  WHERE key = 'admin_password';

  IF p_admin_password IS NULL
     OR btrim(p_admin_password) = ''
     OR v_hashed_password IS NULL
     OR v_hashed_password <> extensions.crypt(p_admin_password, v_hashed_password) THEN
    RETURN QUERY SELECT false, 'invalid_admin_password'::text;
    RETURN;
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupon_history
  WHERE id = p_coupon_id
    AND customer_id = v_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'coupon_not_found'::text;
    RETURN;
  END IF;

  IF v_coupon.is_used THEN
    RETURN QUERY SELECT false, 'coupon_already_used'::text;
    RETURN;
  END IF;

  UPDATE public.coupon_history
  SET is_used = true,
      used_at = now()
  WHERE id = v_coupon.id;

  RETURN QUERY SELECT true, 'ok'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_coupon(integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(integer, text, text) TO anon, authenticated;
