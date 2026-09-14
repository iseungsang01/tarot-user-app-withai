-- 1.0.9 (SEC-3): 회원 탈퇴 시 PII 즉시 마스킹.
--
-- 배경/설계: .kiro/specs/production-hardening/design.md "Req 3 (SEC-3)" 참고.
--   이 앱은 Supabase Auth 를 쓰지 않는다. 인증은 customers 행 + 불투명
--   customer_sessions 토큰(token_hash)이다. 따라서 "Auth 유저 삭제"는 해당 없고,
--   그 자리는 "고객 세션 전부 revoke + 고객 PII 파기(마스킹)"로 대체한다.
--   채택안: 소프트삭제 즉시 + PII 마스킹 + N일 후 하드 퍼지 크론.
--   이 마이그레이션은 그중 "소프트삭제 + PII 마스킹" 부분이다.
--
-- 기존 20260728120000 마이그레이션 대비 변경점:
--   유지 - 비밀번호 불일치 시 무변경 + false 반환 (Req 3.3)
--   유지 - deleted_at = now() 소프트 삭제 + IF NOT FOUND 가드로 재호출 시 false (Req 3.7)
--   유지 - customer_sessions 전부 revoke (Req 3.6)
--   유지 - phone_number 는 건드리지 않는다 (아래 주의 참고)
--   추가 - nickname 등 식별성 필드를 '(탈퇴회원)'로 즉시 마스킹 (Req 3.5)
--
-- 주의(phone_number 를 건드리지 않는 이유): customers.phone_number 는
--   varchar(13) + chk_customers_phone_format CHECK ('^\d{3}-\d{3,4}-\d{4}$') 이다.
--   여기에 마스킹/접미사를 넣으면 22001(value too long) 또는 23514(check violation)
--   로 탈퇴가 실패한다(20260728120000 마이그레이션 주석 참고). 또한 부분 유니크
--   인덱스 idx_customers_phone_active (WHERE deleted_at IS NULL) 덕분에 소프트
--   삭제된 행은 유니크 검사 대상이 아니라 동일 번호 재가입이 이미 정상 동작한다.
--   따라서 phone_number 원본은 유지하고, 완전 파기는 purge_deleted_customers()
--   하드 퍼지 크론(Task 4.2)이 유예 기간 후 담당한다.

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

  -- 비밀번호 불일치 시 무변경 + false (Req 3.3).
  IF NOT public.verify_my_password(p_session_token, input_password) THEN
    RETURN false;
  END IF;

  -- 소프트 삭제 + PII 즉시 마스킹 (Req 3.5).
  --   nickname: varchar(20), '(탈퇴회원)'(6자)은 길이/제약 내라 안전.
  --   birthday: nullable date PII 이므로 NULL 로 파기(제약 없음).
  --   phone_number 는 건드리지 않는다(위 주의 참고). 하드 퍼지 크론이 유예 후 삭제.
  UPDATE public.customers
  SET deleted_at = now(),
      nickname = '(탈퇴회원)',
      birthday = NULL
  WHERE id = v_customer_id AND deleted_at IS NULL;

  -- 이미 deleted_at IS NOT NULL 인 계정 재호출은 여기서 false (Req 3.7).
  IF NOT FOUND THEN RETURN false; END IF;

  -- 고객 세션 전부 revoke. 이후 그 토큰의 모든 RPC 는
  -- resolve_customer_session 이 NULL → 인증 오류 (Req 3.6, 3.7).
  UPDATE public.customer_sessions
  SET revoked_at = now()
  WHERE customer_id = v_customer_id AND revoked_at IS NULL;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account(text, text) TO anon, authenticated;

-- purge_deleted_customers 크론(Task 4.2)은 아래에 추가됨.
