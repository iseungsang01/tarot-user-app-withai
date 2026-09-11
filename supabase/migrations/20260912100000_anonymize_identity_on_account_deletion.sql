-- 탈퇴 시 식별정보 익명화.
--
-- 1차 협의 §3 에서 승인받은 000-0000-0000 치환 + nickname/birthday NULL 이다.
-- 20260728120000 이 접미사 부착을 걷어내 탈퇴 실패(22001)를 먼저 막았고, 이 파일이
-- 그 위에 익명화를 얹는다. 순서가 있으니 20260728120000 을 먼저 적용해야 한다.
--
-- 왜 지금인가: 매니저의 delete_my_account(uuid) 가 프로덕션에서 DROP 된 것을
-- 2026-09-11 실측으로 확인했다(anon probe 0/5). 두 경로가 갈릴 일이 없어졌다.
--
-- 000-0000-0000 이 안전한 이유
--   길이 12 < varchar(13)                     → 22001 안 남
--   chk_customers_phone_format 에 매칭         → 23514 안 남
--   idx_customers_phone_active 는 부분 인덱스  → 탈퇴 행끼리 충돌 없음
--     (WHERE deleted_at IS NULL. 같은 UPDATE 에서 deleted_at 을 함께 채우므로
--      이 행은 인덱스 대상에서 빠진다)
--   원래 번호가 풀림                           → 같은 번호로 재가입 가능
--
-- 이미 탈퇴한 회원의 번호는 건드리지 않는다. 되돌릴 수 없는 일괄 변경이고 아직
-- 합의된 바가 없어서, 소급 여부는 매니저·점주 판단을 받고 별도로 올린다.
--
-- 딸린 결과: 번호가 지워지므로 "같은 번호로 재가입한 손님의 과거 이력 확인"은
-- 더 이상 되지 않는다. 개인정보 처리방침 제4조 ③ 의 문구도 같이 고쳤다.

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

GRANT EXECUTE ON FUNCTION public.delete_my_account(text, text) TO anon, authenticated;
