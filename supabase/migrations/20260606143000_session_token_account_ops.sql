-- 1.0.6: session-token based sensitive customer account operations.
CREATE OR REPLACE FUNCTION public.verify_my_password(p_session_token text, input_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_hashed_password text;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT password INTO v_hashed_password
  FROM public.customers
  WHERE id = v_customer_id AND deleted_at IS NULL;

  RETURN v_hashed_password IS NOT NULL AND v_hashed_password = extensions.crypt(input_password, v_hashed_password);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_password(p_session_token text, current_password text, new_password text, p_reason text DEFAULT 'settings_change')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.verify_my_password(p_session_token, current_password) THEN
    RETURN false;
  END IF;

  IF NOT public.validate_password_complexity(new_password) THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;

  UPDATE public.customers
  SET password = extensions.crypt(new_password, extensions.gen_salt('bf')), must_change_password = false
  WHERE id = v_customer_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.customer_password_audit_logs (customer_id, changed_by, reason, metadata)
  VALUES (v_customer_id, 'customer', p_reason, jsonb_build_object('source', 'update_my_password'));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_account(p_session_token text, input_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.verify_my_password(p_session_token, input_password) THEN
    RETURN false;
  END IF;

  UPDATE public.customers
  SET deleted_at = now(), phone_number = phone_number || '_deleted_' || substring(md5(random()::text) from 1 for 5)
  WHERE id = v_customer_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.customer_sessions
  SET revoked_at = now()
  WHERE customer_id = v_customer_id AND revoked_at IS NULL;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_my_password(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_password(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text, text) TO anon, authenticated;
