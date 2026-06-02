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
  v_config_hash text;
  v_legacy_password text;
  v_coupon public.coupon_history%ROWTYPE;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RETURN QUERY SELECT false, 'invalid_session'::text;
    RETURN;
  END IF;

  IF p_admin_password IS NULL OR btrim(p_admin_password) = '' THEN
    RETURN QUERY SELECT false, 'invalid_admin_password'::text;
    RETURN;
  END IF;

  IF to_regclass('public.app_configs') IS NOT NULL THEN
    EXECUTE 'SELECT value FROM public.app_configs WHERE key = $1'
      INTO v_config_hash
      USING 'admin_password';
  END IF;

  v_legacy_password := current_setting('app.admin_password', true);

  IF NOT (
    (v_config_hash IS NOT NULL AND v_config_hash = extensions.crypt(p_admin_password, v_config_hash))
    OR (v_legacy_password IS NOT NULL AND v_legacy_password = p_admin_password)
  ) THEN
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
