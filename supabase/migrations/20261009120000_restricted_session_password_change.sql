-- 제한 세션: 임시 비밀번호(must_change_password) 고객은 비밀번호 변경만 쓸 수 있다.
--
-- 왜:
--   매장 등록·재발급으로 받은 임시 비밀번호 세션이 쿠폰·투표·AI·탈퇴까지 다 쓸 수 있었다.
--   매니저 8차(tarot-manager-app supabase/sql/20261009_security_round8.sql §3)가
--   resolve_customer_session 에서 must_change_password 고객의 세션을 무효로 보게 바꿨다.
--   이 파일은 강제 변경 흐름에 필요한 세 함수만 제한 세션을 받는 해석기로 옮긴다.
--     - get_my_profile    : 앱 재시작 시 세션 복원 → must_change_password 로 강제 변경 화면
--     - verify_my_password: update_my_password 가 현재 비밀번호 확인에 쓴다
--     - update_my_password: 성공하면 must_change_password=false → 같은 세션이 정상 세션이 된다
--   delete_my_account 는 자기 resolve_customer_session 호출에서 먼저 막힌다.
--
-- 선행: 매니저 20261009_security_round8.sql (resolve_customer_session_allow_restricted).
-- 본문은 20261008150000 · schema.sql 의 판과 같고 해석기 호출만 다르다.

DO $$
BEGIN
  IF to_regprocedure('public.resolve_customer_session_allow_restricted(text)') IS NULL THEN
    RAISE EXCEPTION '매니저 20261009_security_round8.sql 을 먼저 적용하세요.';
  END IF;
END $$;

-- ── 1. verify_my_password ─────────────────────────────────────────────
-- 재확인 시도는 고객당 시간당 10회. 성공도 센다(정상 사용은 화면당 1회).
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
  v_customer_id := public.resolve_customer_session_allow_restricted(p_session_token);
  IF v_customer_id IS NULL OR input_password IS NULL OR input_password = '' THEN
    RETURN false;
  END IF;

  IF NOT public.hit_ai_rate_counter('reauth:' || v_customer_id::text, interval '1 hour', 10) THEN
    RETURN false;
  END IF;

  SELECT password INTO v_hashed_password
  FROM public.customers
  WHERE id = v_customer_id AND deleted_at IS NULL;

  RETURN COALESCE(v_hashed_password = extensions.crypt(input_password, v_hashed_password), false);
END;
$$;

-- ── 2. update_my_password ─────────────────────────────────────────────
-- 정책 위반은 22023 으로 던진다(앱이 코드로 문구를 고른다). 바꾼 세션만 남기고
-- 같은 고객의 다른 세션은 모두 끊는다.
CREATE OR REPLACE FUNCTION public.update_my_password(p_session_token text, current_password text, new_password text, p_reason text DEFAULT 'settings_change')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session_allow_restricted(p_session_token);
  IF v_customer_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT COALESCE(public.verify_my_password(p_session_token, current_password), false) THEN
    RETURN false;
  END IF;

  IF NOT COALESCE(public.validate_password_complexity(new_password), false) THEN
    RAISE EXCEPTION 'Password does not meet the policy.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.customers
  SET password = extensions.crypt(new_password, extensions.gen_salt('bf')), must_change_password = false
  WHERE id = v_customer_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.customer_sessions
  SET revoked_at = now()
  WHERE customer_id = v_customer_id
    AND revoked_at IS NULL
    AND token_hash <> encode(extensions.digest(p_session_token, 'sha256'), 'hex');

  INSERT INTO public.customer_password_audit_logs (customer_id, changed_by, reason, metadata)
  VALUES (v_customer_id, 'customer', left(COALESCE(p_reason, 'settings_change'), 50),
          jsonb_build_object('source', 'update_my_password'));

  RETURN true;
END;
$$;

-- ── 3. get_my_profile ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_profile(p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_customer public.customers%ROWTYPE; v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session_allow_restricted(p_session_token);
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired session.');
  END IF;
  SELECT * INTO v_customer FROM public.customers WHERE id = v_customer_id AND deleted_at IS NULL;
  RETURN jsonb_build_object('success', true, 'customer', to_jsonb(v_customer) - 'password');
END;
$$;
