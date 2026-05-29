-- Repair customer-facing coupon and bug-report access for opaque app sessions.
-- The mobile customer app does not use Supabase Auth JWTs; it uses
-- customer_sessions tokens validated inside SECURITY DEFINER RPCs.

-- Existing deployments may predate the latest bug report fields.
ALTER TABLE IF EXISTS public.bug_reports
  ADD COLUMN IF NOT EXISTS report_type varchar(30) NOT NULL DEFAULT '어플 버그',
  ADD COLUMN IF NOT EXISTS screenshot text,
  ADD COLUMN IF NOT EXISTS device_info jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_response text DEFAULT '';

-- Keep customer coupon reads/writes behind RPCs so anon mobile clients do not
-- need direct coupon_history privileges or a Supabase Auth JWT.
CREATE OR REPLACE FUNCTION public.get_my_coupons(
  p_session_token text,
  p_valid_only boolean DEFAULT false
)
RETURNS SETOF public.coupon_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT ch.*
  FROM public.coupon_history ch
  WHERE ch.customer_id = v_customer_id
    AND ch.is_used = false
    AND (
      NOT p_valid_only
      OR ch.valid_until IS NULL
      OR ch.valid_until >= now()
    )
  ORDER BY ch.issued_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_coupon_count(
  p_session_token text,
  p_valid_only boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_count integer;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000';
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.coupon_history ch
  WHERE ch.customer_id = v_customer_id
    AND ch.is_used = false
    AND (
      NOT p_valid_only
      OR ch.valid_until IS NULL
      OR ch.valid_until >= now()
    );

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.use_my_coupon(
  p_session_token text,
  p_coupon_id integer
)
RETURNS public.coupon_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_coupon public.coupon_history%ROWTYPE;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000';
  END IF;

  UPDATE public.coupon_history
  SET is_used = true,
      used_at = now()
  WHERE id = p_coupon_id
    AND customer_id = v_customer_id
    AND is_used = false
    AND (valid_until IS NULL OR valid_until >= now())
  RETURNING * INTO v_coupon;

  IF v_coupon.id IS NULL THEN
    RAISE EXCEPTION 'Coupon not found, already used, or expired' USING ERRCODE = '02000';
  END IF;

  RETURN v_coupon;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_coupons(text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_coupon_count(text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.use_my_coupon(text, integer) TO anon, authenticated;

-- Recreate bug-report RPCs after adding missing columns so older databases can
-- accept screenshot/device_info payloads.
CREATE OR REPLACE FUNCTION public.get_my_bug_reports(p_session_token text)
RETURNS SETOF public.bug_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT br.*
  FROM public.bug_reports br
  WHERE br.customer_id = v_customer_id
  ORDER BY br.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_bug_report(
  p_session_token text,
  p_title text,
  p_description text,
  p_report_type text DEFAULT '어플 버그',
  p_screenshot text DEFAULT NULL,
  p_device_info jsonb DEFAULT NULL
)
RETURNS public.bug_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_report public.bug_reports%ROWTYPE;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000';
  END IF;

  IF length(trim(coalesce(p_title, ''))) = 0 THEN
    RAISE EXCEPTION 'Report title is required' USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(p_description, ''))) = 0 THEN
    RAISE EXCEPTION 'Report description is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.bug_reports (
    customer_id,
    title,
    description,
    report_type,
    screenshot,
    device_info,
    status
  )
  VALUES (
    v_customer_id,
    left(trim(p_title), 100),
    trim(p_description),
    coalesce(nullif(trim(p_report_type), ''), '어플 버그'),
    nullif(trim(coalesce(p_screenshot, '')), ''),
    coalesce(p_device_info, '{}'::jsonb),
    '접수'
  )
  RETURNING * INTO v_report;

  RETURN v_report;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_bug_reports(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_bug_report(text, text, text, text, text, jsonb) TO anon, authenticated;
