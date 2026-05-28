-- Customer bug reports are accessed through opaque app-session RPCs.
-- Direct table access remains unavailable to anon customer clients; these
-- SECURITY DEFINER functions validate customer_sessions before reading/writing.

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
