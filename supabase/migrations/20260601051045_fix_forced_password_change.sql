CREATE OR REPLACE FUNCTION public.update_customer_password(
  customer_uuid uuid,
  new_password text,
  p_reason text DEFAULT 'user_change'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.validate_password_complexity(new_password) THEN
    RAISE EXCEPTION '비밀번호는 6자 이상이어야 합니다.';
  END IF;

  UPDATE public.customers
  SET password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      must_change_password = false
  WHERE id = customer_uuid
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.customer_password_audit_logs (customer_id, changed_by, reason, metadata)
  VALUES (customer_uuid, 'customer', p_reason, jsonb_build_object('source', 'update_customer_password'));

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_customer_password(uuid, text, text) TO anon, authenticated;
