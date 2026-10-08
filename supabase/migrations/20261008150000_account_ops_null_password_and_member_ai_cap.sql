-- 비밀번호 재확인 함수의 NULL 우회 차단 + 재확인 시도 한도 + 비밀번호 변경 시 다른 세션 폐기
-- + 회원 전체 AI 일일 상한.
--
-- 왜:
-- 1) extensions.crypt() 는 STRICT 라 input_password 가 NULL 이면 NULL 을 돌려준다.
--    verify_my_password 가 false 가 아니라 NULL 을 반환했고, 호출부의
--    `IF NOT verify_my_password(...)` 는 NOT NULL = NULL 이라 실패 분기를 건너뛰었다.
--    세션 토큰만 있으면 current_password=null 로 비밀번호를 바꾸거나(계정 탈취)
--    input_password=null 로 계정을 지울 수 있었다 (로컬 PGlite 재현).
-- 2) 세션 토큰 하나로 verify_my_password 를 무제한 대입할 수 있었다.
-- 3) 토큰 유출을 의심해 비밀번호를 바꿔도 다른 세션이 30일간 살아 있었다.
-- 4) consume_ai_proxy_quota 의 전체 상한이 게스트에만 있었다. register_customer 는
--    무제한·무인증이라 계정을 찍어 내면 계정당 하루 60회씩 비용이 늘었다.
--
-- 이 파일의 객체는 모두 유저앱 단독 소유다.
-- 선행: 20261008120000_ai_proxy_server_side_quota.sql (hit_ai_rate_counter)

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
  v_customer_id := public.resolve_customer_session(p_session_token);
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
  v_customer_id := public.resolve_customer_session(p_session_token);
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

-- ── 3. delete_my_account(text, text) ──────────────────────────────────
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

  IF NOT COALESCE(public.verify_my_password(p_session_token, input_password), false) THEN
    RETURN false;
  END IF;

  -- 식별정보를 지우고 비활성화한다. '_deleted_' 접미사를 붙이던 옛 방식은
  -- varchar(13) 초과(22001)로 탈퇴가 항상 실패했다. 000-0000-0000 은 12자라
  -- 길이에 맞고 chk_customers_phone_format('^\d{3}-\d{3,4}-\d{4}$')도 통과한다.
  -- 탈퇴 행이 여럿 같은 값이어도 idx_customers_phone_active 가
  -- WHERE deleted_at IS NULL 부분 인덱스라 충돌하지 않고, 원래 번호는 풀려서
  -- 같은 번호로 재가입도 된다.
  UPDATE public.customers
  SET deleted_at = now(),
      phone_number = '000-0000-0000',
      nickname = NULL,
      birthday = NULL
  WHERE id = v_customer_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.customer_sessions
  SET revoked_at = now()
  WHERE customer_id = v_customer_id AND revoked_at IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_my_password(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_password(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_my_account(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_my_password(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_password(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text, text) TO anon, authenticated;

-- ── 4. consume_ai_proxy_quota: 회원 전체 일일 상한 ──────────────────────
CREATE OR REPLACE FUNCTION public.consume_ai_proxy_quota(p_subject text, p_client_ip text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_guest boolean := p_subject LIKE 'guest:%';
BEGIN
  IF p_subject IS NULL OR length(p_subject) = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_subject');
  END IF;

  IF NOT public.hit_ai_rate_counter('subject:' || p_subject || ':minute', interval '1 minute', 6) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subject_minute');
  END IF;

  IF NOT public.hit_ai_rate_counter('subject:' || p_subject || ':day', interval '1 day',
                                    CASE WHEN v_is_guest THEN 20 ELSE 60 END) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subject_day');
  END IF;

  IF COALESCE(p_client_ip, '') <> ''
     AND NOT public.hit_ai_rate_counter('ip:' || p_client_ip || ':minute', interval '1 minute', 30) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'ip_minute');
  END IF;

  -- 전체 상한이 비용 상한이다. 게스트는 세션을 새로 받으면, 회원은 가입을 새로 하면
  -- 개인 한도가 초기화된다.
  IF v_is_guest AND NOT public.hit_ai_rate_counter('guests:day', interval '1 day', 2000) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'guests_day');
  END IF;

  IF NOT v_is_guest AND NOT public.hit_ai_rate_counter('members:day', interval '1 day', 5000) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'members_day');
  END IF;

  -- 지난 창은 가끔 지운다. 일일 창이 가장 길어서 2일이면 충분하다.
  IF random() < 0.01 THEN
    DELETE FROM public.ai_proxy_rate_counters WHERE window_start < now() - interval '2 days';
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_proxy_quota(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_proxy_quota(text, text) TO service_role;
