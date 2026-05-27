-- Move the customer-facing app away from Supabase Auth/fake-email sessions.
-- Customer identity is represented by opaque app session tokens that are
-- validated inside SECURITY DEFINER RPCs. Manager Admin JWT policies remain
-- separate and are not changed here.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Supabase Auth is no longer the owner of public.customers.id for the
-- customer-facing app. Existing deployments may have this constraint from the
-- previous fake-email bridge; drop it so register_customer can use native UUIDs.
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_id_fkey_auth_users;

CREATE TABLE IF NOT EXISTS public.login_attempt_tracker (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone_hash text NOT NULL,
  ip_device_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  lock_expires_at timestamptz,
  last_failed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_hash, ip_device_hash)
);

CREATE INDEX IF NOT EXISTS idx_login_attempt_tracker_phone_hash
  ON public.login_attempt_tracker(phone_hash);
CREATE INDEX IF NOT EXISTS idx_login_attempt_tracker_lock_expires_at
  ON public.login_attempt_tracker(lock_expires_at);

ALTER TABLE public.login_attempt_tracker ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No Direct Access login_attempt_tracker" ON public.login_attempt_tracker;
CREATE POLICY "No Direct Access login_attempt_tracker"
ON public.login_attempt_tracker
FOR ALL
USING (false)
WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.customer_sessions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer
  ON public.customer_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_valid
  ON public.customer_sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No Direct Access customer_sessions" ON public.customer_sessions;
CREATE POLICY "No Direct Access customer_sessions"
ON public.customer_sessions
FOR ALL
USING (false)
WITH CHECK (false);

DROP FUNCTION IF EXISTS public.register_customer(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.register_customer(text, text, text);

CREATE OR REPLACE FUNCTION public.register_customer(
  p_phone text,
  p_password text,
  p_nickname text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_nickname text;
BEGIN
  IF p_phone !~ '^\d{3}-\d{3,4}-\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'message', '전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)');
  END IF;

  IF length(coalesce(p_password, '')) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', '비밀번호는 6자 이상이어야 합니다.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.customers WHERE phone_number = p_phone AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'message', '이미 가입된 전화번호입니다.');
  END IF;

  v_nickname := COALESCE(NULLIF(p_nickname, ''), '유저_' || right(p_phone, 4));

  INSERT INTO public.customers (phone_number, password, nickname)
  VALUES (p_phone, extensions.crypt(p_password, extensions.gen_salt('bf')), v_nickname)
  RETURNING id INTO v_customer_id;

  RETURN jsonb_build_object('success', true, 'id', v_customer_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', '회원가입 에러: ' || SQLERRM);
END;
$$;

DROP FUNCTION IF EXISTS public.login_customer(text, text);
DROP FUNCTION IF EXISTS public.login_customer(text, text, text);

CREATE OR REPLACE FUNCTION public.login_customer(
  p_phone text,
  p_password text,
  p_client_fingerprint text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_phone_hash text;
  v_device_hash text;
  v_phone_lock_expires_at timestamptz;
  v_device_lock_expires_at timestamptz;
  v_lock_expires_at timestamptz;
  v_max_failed_attempts integer := 5;
  v_lock_minutes integer := 5;
  v_session_token text;
  v_token_hash text;
BEGIN
  v_phone_hash := encode(extensions.digest(p_phone, 'sha256'), 'hex');
  v_device_hash := encode(extensions.digest(COALESCE(NULLIF(trim(p_client_fingerprint), ''), 'unknown'), 'sha256'), 'hex');

  SELECT lock_expires_at INTO v_phone_lock_expires_at
  FROM public.login_attempt_tracker
  WHERE phone_hash = v_phone_hash
    AND ip_device_hash = '__phone__';

  SELECT lock_expires_at INTO v_device_lock_expires_at
  FROM public.login_attempt_tracker
  WHERE phone_hash = v_phone_hash
    AND ip_device_hash = v_device_hash;

  v_lock_expires_at := GREATEST(
    COALESCE(v_phone_lock_expires_at, '-infinity'::timestamptz),
    COALESCE(v_device_lock_expires_at, '-infinity'::timestamptz)
  );

  IF v_lock_expires_at > now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'locked', true,
      'lock_expires_at', v_lock_expires_at,
      'message', '로그인 시도가 많아 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.'
    );
  END IF;

  SELECT * INTO v_customer
  FROM public.customers
  WHERE phone_number = p_phone
    AND deleted_at IS NULL;

  IF v_customer.id IS NULL OR v_customer.password != extensions.crypt(p_password, v_customer.password) THEN
    INSERT INTO public.login_attempt_tracker (phone_hash, ip_device_hash, failed_attempts, lock_expires_at, last_failed_at, updated_at)
    VALUES (v_phone_hash, '__phone__', 1, NULL, now(), now())
    ON CONFLICT (phone_hash, ip_device_hash)
    DO UPDATE SET
      failed_attempts = CASE
        WHEN COALESCE(public.login_attempt_tracker.lock_expires_at, '-infinity'::timestamptz) > now()
          THEN public.login_attempt_tracker.failed_attempts
        ELSE public.login_attempt_tracker.failed_attempts + 1
      END,
      lock_expires_at = CASE
        WHEN COALESCE(public.login_attempt_tracker.lock_expires_at, '-infinity'::timestamptz) > now()
          THEN public.login_attempt_tracker.lock_expires_at
        WHEN public.login_attempt_tracker.failed_attempts + 1 >= v_max_failed_attempts
          THEN now() + make_interval(mins => v_lock_minutes)
        ELSE NULL
      END,
      last_failed_at = now(),
      updated_at = now();

    INSERT INTO public.login_attempt_tracker (phone_hash, ip_device_hash, failed_attempts, lock_expires_at, last_failed_at, updated_at)
    VALUES (v_phone_hash, v_device_hash, 1, NULL, now(), now())
    ON CONFLICT (phone_hash, ip_device_hash)
    DO UPDATE SET
      failed_attempts = CASE
        WHEN COALESCE(public.login_attempt_tracker.lock_expires_at, '-infinity'::timestamptz) > now()
          THEN public.login_attempt_tracker.failed_attempts
        ELSE public.login_attempt_tracker.failed_attempts + 1
      END,
      lock_expires_at = CASE
        WHEN COALESCE(public.login_attempt_tracker.lock_expires_at, '-infinity'::timestamptz) > now()
          THEN public.login_attempt_tracker.lock_expires_at
        WHEN public.login_attempt_tracker.failed_attempts + 1 >= v_max_failed_attempts
          THEN now() + make_interval(mins => v_lock_minutes)
        ELSE NULL
      END,
      last_failed_at = now(),
      updated_at = now();

    RETURN jsonb_build_object('success', false, 'reason', 'INVALID_PASSWORD', 'message', '전화번호 또는 비밀번호가 일치하지 않습니다.');
  END IF;

  DELETE FROM public.login_attempt_tracker
  WHERE phone_hash = v_phone_hash
    AND ip_device_hash IN ('__phone__', v_device_hash);

  v_session_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_session_token, 'sha256'), 'hex');

  INSERT INTO public.customer_sessions (customer_id, token_hash, expires_at, last_used_at)
  VALUES (v_customer.id, v_token_hash, now() + interval '30 days', now());

  RETURN jsonb_build_object(
    'success', true,
    'session_token', v_session_token,
    'expires_at', now() + interval '30 days',
    'customer', to_jsonb(v_customer) - 'password'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile(p_session_token text)
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
    RETURN jsonb_build_object('success', false, 'message', '세션 토큰이 없습니다.');
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
    RETURN jsonb_build_object('success', false, 'message', '세션이 만료되었거나 회원 정보를 찾을 수 없습니다.');
  END IF;

  UPDATE public.customer_sessions
  SET last_used_at = now()
  WHERE token_hash = v_token_hash;

  RETURN jsonb_build_object('success', true, 'customer', to_jsonb(v_customer) - 'password');
END;
$$;

CREATE OR REPLACE FUNCTION public.logout_customer(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.customer_sessions
  SET revoked_at = now()
  WHERE token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND revoked_at IS NULL;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_customer(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_customer(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.logout_customer(text) TO anon, authenticated;
