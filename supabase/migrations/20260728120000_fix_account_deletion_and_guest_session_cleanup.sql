-- 1.0.8: 회원 탈퇴 실패 수정 + AI 게스트 세션 정리.
--
-- 배경: delete_my_account 는 소프트 삭제 시 phone_number 뒤에
--       '_deleted_' + md5 5자리를 붙였다. 그런데 customers.phone_number 는
--       varchar(13) 이고 '010-1234-5678' 이 이미 정확히 13자라 27자가 되어
--       SQLSTATE 22001(value too long) 로 항상 실패했다. 설령 타입이 넓었어도
--       chk_customers_phone_format CHECK ('^\d{3}-\d{3,4}-\d{4}$') 에서
--       23514 로 막힌다. 즉 탈퇴가 구조적으로 불가능한 상태였다.
--
-- 수정: 접미사 부착을 제거한다. 애초에 중복 회피 목적이었는데
--       idx_customers_phone_active 가 WHERE deleted_at IS NULL 부분 인덱스라
--       소프트 삭제된 행은 유니크 검사 대상이 아니다. 접미사 없이도
--       동일 번호 재가입이 정상 동작한다.
--
-- 주의: 이 함수는 유저앱 전용(매니저 스키마에 존재하지 않음)이라 단독 수정이 안전하다.
--       매니저 스키마가 소유한 delete_my_account(uuid) 는 동일 버그가 남아 있으며
--       별도 협의 항목이다. docs/manager-app-db-issues.md 참고.
--       탈퇴 시 전화번호 파기(마스킹) 여부도 매니저 협의 항목이다.

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

  -- phone_number 는 건드리지 않는다. 부분 유니크 인덱스가 재가입을 이미 허용한다.
  UPDATE public.customers
  SET deleted_at = now()
  WHERE id = v_customer_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.customer_sessions
  SET revoked_at = now()
  WHERE customer_id = v_customer_id AND revoked_at IS NULL;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account(text, text) TO anon, authenticated;


-- AI 게스트 세션 정리.
-- issue_ai_guest_session 이 anon 에 무제한 공개라 호출당 행이 1개씩 쌓이고
-- 만료 후에도 삭제되지 않는다. 운영자(service_role/postgres)가 주기 실행한다.
CREATE INDEX IF NOT EXISTS idx_ai_guest_sessions_expires_at
  ON public.ai_guest_sessions(expires_at);

CREATE OR REPLACE FUNCTION public.cleanup_ai_guest_sessions(p_retention interval DEFAULT interval '7 days')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.ai_guest_sessions
  WHERE expires_at < now() - p_retention
     OR (revoked_at IS NOT NULL AND revoked_at < now() - p_retention);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 클라이언트 롤에는 노출하지 않는다.
REVOKE ALL ON FUNCTION public.cleanup_ai_guest_sessions(interval) FROM PUBLIC, anon, authenticated;

-- 주기 실행 예시 (pg_cron 활성화 후 운영자가 1회 등록):
--   SELECT cron.schedule('cleanup-ai-guest-sessions', '0 4 * * *',
--                        $cron$ SELECT public.cleanup_ai_guest_sessions(); $cron$);
