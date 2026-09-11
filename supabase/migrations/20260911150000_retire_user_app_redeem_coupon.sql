-- 유저앱이 들고 있던 redeem_coupon(GUC 판) 회수.
--
-- 배경
--   쿠폰 사용의 관리자 비밀번호 검증을 DB 밖으로 옮기기로 확정했다.
--   (docs/manager-app-db-issues-round2.md §2 [확정3] — 매장 직원이 고객 폰에서
--    비밀번호를 입력하므로 호출 주체는 고객 앱, 검증은 Edge Function 시크릿)
--   클라이언트는 이제 rpc('redeem_coupon') 대신 POST /functions/v1/redeem-coupon
--   을 호출한다. 따라서 이 RPC 는 어느 롤에도 필요 없다.
--
-- 왜 파일에서 지우는 것만으로 부족한가
--   supabase/schema.sql 에서 정의와 GRANT 를 지웠지만, 20260601051045 와
--   20260604042031 두 마이그레이션에 같은 CREATE OR REPLACE + GRANT 가 남아 있다.
--   db reset 을 하면 그대로 되살아나서, 관리자 비밀번호를 GUC
--   (app.admin_password_hash / app.admin_password) 에서 읽는 판이 다시 배포된다.
--   GUC 가 세팅돼 있지 않으면 모든 쿠폰 사용이 invalid_admin_password 로 실패한다 —
--   과거에 쿠폰이 깨졌던 바로 그 조건이다. 후속 마이그레이션으로 정리한다.
--
-- 안전장치
--   본문이 GUC 를 읽는 "유저앱 판"일 때만 DROP 한다. 다른 본문(예: 매니저가
--   app_configs 판을 배포한 경우)이 올라와 있으면 남의 객체이므로 손대지 않고
--   클라이언트 롤 권한만 회수한다. 2026-09-11 운영 실측 기준 app_configs 는
--   존재하지 않아 배포본은 GUC 판이 확정적이다.
--   재현: node supabase/tests/probe_rpc_surface.mjs
--
-- 같이 남기는 메모 — use_my_coupon(text, integer) 은 매니저 소유다.
--   위 두 마이그레이션과 schema.sql 이 이 함수를 DROP 하고 있었고, 그래서 운영에서
--   404 PGRST202 가 났다. schema.sql 에서는 DROP 을 걷어냈다. 여기서 다시 만들지는
--   않는다 — 매니저 정본(SupabaseSQL.sql:543)을 매니저가 재적용해야 한다.

DO $$
DECLARE
  v_signature constant text := 'public.redeem_coupon(integer, text, text)';
  v_def text;
BEGIN
  IF to_regprocedure(v_signature) IS NULL THEN
    RAISE NOTICE 'already absent: %', v_signature;
    RETURN;
  END IF;

  v_def := pg_get_functiondef(to_regprocedure(v_signature));

  IF v_def LIKE '%current_setting(''app.admin_password%' THEN
    EXECUTE format('DROP FUNCTION %s', v_signature);
    RAISE NOTICE 'dropped user-app GUC variant: %', v_signature;
  ELSE
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_signature);
    RAISE NOTICE 'foreign variant kept, client grants revoked: %', v_signature;
  END IF;
END $$;
