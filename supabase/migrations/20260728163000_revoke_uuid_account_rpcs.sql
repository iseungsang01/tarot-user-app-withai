-- 1.0.8: 세션 검증 없는 uuid 기반 계정 조작 RPC 의 anon/authenticated 권한 회수.
--
-- 대상 5개는 p_id / customer_uuid 만 받고 resolve_customer_session 호출이 없는데
-- anon 에 EXECUTE 가 부여돼 있었다. anon 키는 앱 번들에 그대로 실려 나가므로
-- uuid 만 알면 타인 계정을 탈퇴시키거나 비밀번호를 바꿀 수 있었다.
-- 2026-07-28 운영 probe 에서 5개 전부 anon 호출 가능(22P02)으로 실측 확인됐다.
--   재현: node supabase/tests/probe_rpc_surface.mjs
--
-- 특히 두 개가 심각하다.
--   update_customer_password : 현재 비밀번호 확인 없이 새 비밀번호로 덮어씀 (계정 탈취)
--   verify_password          : 락아웃 없는 무제한 비밀번호 대입 오라클
--
-- 대체 경로는 전부 세션 토큰판이며 이미 배포돼 있다.
--   update_my_password(text,text,text,text) / verify_my_password(text,text)
--   delete_my_account(text,text)
-- 유저앱은 이 5개를 호출하는 코드를 커밋 747f308 에서 이미 제거했고,
-- 매니저 앱은 register_customer 하나만 호출하므로 양쪽 모두 영향이 없다.
--
-- 순서: 유저앱이 GRANT 를 먼저 걷어낸 뒤 매니저가 DROP 한다.
--       (soft_delete_customer 가 delete_my_account(uuid) 에 의존하므로 DROP 순서도 중요)
-- 여기서 DROP 하지 않고 REVOKE 만 하는 것은 매니저 회신의 조치 순서를 따르기 위해서다.
-- 근거: docs/manager-app-db-issues.md §2, 매니저 회신 §2 / N2.

DO $$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.update_my_nickname(uuid, text)',
    'public.delete_my_account(uuid)',
    'public.soft_delete_customer(uuid)',
    'public.verify_password(uuid, text)',
    'public.update_customer_password(uuid, text, text)'
  ]
  LOOP
    -- 이미 DROP 된 환경에서도 마이그레이션이 실패하지 않도록 존재 여부를 먼저 확인한다.
    IF to_regprocedure(v_signature) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_signature);
      RAISE NOTICE 'revoked: %', v_signature;
    ELSE
      RAISE NOTICE 'already absent: %', v_signature;
    END IF;
  END LOOP;
END $$;
