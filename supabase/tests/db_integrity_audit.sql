-- DB 강건성 진단 (읽기 전용). Supabase SQL Editor에서 섹션별로 실행.
-- 목적: 레포의 SQL 파일과 운영 DB의 실제 상태가 일치하는지 확인한다.
--       CREATE TABLE IF NOT EXISTS 방식이라 파일 = 운영 상태가 보장되지 않는다.

-- ============================================================
-- 1. P0-1 검증: phone_number 타입/제약이 소프트 삭제와 충돌하는가
-- ============================================================
SELECT
  a.attname,
  format_type(a.atttypid, a.atttypmod) AS actual_type,
  a.attnotnull
FROM pg_attribute a
WHERE a.attrelid = 'public.customers'::regclass
  AND a.attname IN ('phone_number', 'nickname', 'password')
  AND a.attnum > 0;
-- 기대: phone_number가 character varying(13)이면 탈퇴 UPDATE는 항상 22001로 실패.

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.customers'::regclass;
-- 기대: chk_customers_phone_format이 살아 있으면 접미사 붙은 값은 23514로도 실패.

-- 실제로 실패하는지 무해하게 확인 (롤백됨)
DO $$
DECLARE v_sample text;
BEGIN
  SELECT phone_number INTO v_sample FROM public.customers WHERE deleted_at IS NULL LIMIT 1;
  IF v_sample IS NULL THEN
    RAISE NOTICE '검사할 활성 고객 없음';
    RETURN;
  END IF;
  BEGIN
    PERFORM (v_sample || '_deleted_abcde')::varchar(13);
    RAISE NOTICE '통과: 길이 문제 없음';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '실패 확인 -> SQLSTATE=% / %', SQLSTATE, SQLERRM;
  END;
END $$;

-- 이미 탈퇴 시도가 있었다면 흔적 확인 (성공했다면 이런 행이 존재)
SELECT count(*) AS soft_deleted_rows
FROM public.customers
WHERE deleted_at IS NOT NULL;

SELECT count(*) AS malformed_phone_rows
FROM public.customers
WHERE phone_number !~ '^\d{3}-\d{3,4}-\d{4}$';


-- ============================================================
-- 2. P0-2 검증: anon이 visit_history에 쓸 수 있는가
-- ============================================================
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'visit_history'
ORDER BY grantee, privilege_type;
-- 기대: anon 행이 없음 -> 앱의 createVisit/updateVisit은 42501로 실패.

SELECT polname, polroles::regrole[] AS roles, polcmd,
       pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy
WHERE polrelid = 'public.visit_history'::regclass;


-- ============================================================
-- 3. P0-3 검증: redeem_coupon이 어느 소스에서 관리자 비밀번호를 읽는가
-- ============================================================
SELECT p.proname,
       CASE
         WHEN pg_get_functiondef(p.oid) LIKE '%app_configs%'    THEN 'app_configs (매니저 버전, 정상)'
         WHEN pg_get_functiondef(p.oid) LIKE '%current_setting%' THEN 'GUC (유저앱 버전, 쿠폰 사용 깨짐)'
         ELSE '기타'
       END AS admin_password_source
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('redeem_coupon', 'verify_admin_password');

SELECT to_regclass('public.app_configs') AS app_configs_exists;


-- ============================================================
-- 4. P1-4 검증: 세션 검증 없이 anon에 열린 uuid 기반 RPC
-- ============================================================
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_functiondef(p.oid) LIKE '%resolve_customer_session%' AS has_session_check,
  has_function_privilege('anon', p.oid, 'EXECUTE')            AS anon_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'delete_my_account', 'soft_delete_customer', 'update_my_nickname',
    'verify_password', 'update_customer_password'
  )
ORDER BY p.proname, args;
-- 위험: has_session_check = false AND anon_can_execute = true 인 행.


-- ============================================================
-- 5. P1-7 검증: 카운터 컬럼 vs 이력 테이블 드리프트
-- ============================================================
SELECT
  c.id,
  c.phone_number,
  c.visit_count      AS counter_visits,
  v.actual_visits,
  c.coupons          AS counter_coupons,
  cp.actual_unused_coupons
FROM public.customers c
LEFT JOIN LATERAL (
  SELECT count(*)::int AS actual_visits
  FROM public.visit_history vh
  WHERE vh.customer_id = c.id AND vh.is_deleted = false
) v ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS actual_unused_coupons
  FROM public.coupon_history ch
  WHERE ch.customer_id = c.id AND ch.is_used = false
) cp ON true
WHERE c.deleted_at IS NULL
  AND (c.visit_count <> v.actual_visits OR c.coupons <> cp.actual_unused_coupons)
ORDER BY abs(c.visit_count - v.actual_visits) DESC
LIMIT 50;


-- ============================================================
-- 6. P1-8 검증: 이미 사용된 만료 쿠폰 (redeem_coupon의 valid_until 미검사 결과)
-- ============================================================
SELECT count(*) AS redeemed_after_expiry
FROM public.coupon_history
WHERE is_used = true AND valid_until IS NOT NULL AND used_at > valid_until;

-- coupon_history 상태 제약 위반 (있으면 안 됨)
SELECT count(*) AS status_inconsistent
FROM public.coupon_history
WHERE (used_at IS NULL) <> (is_used = false);


-- ============================================================
-- 7. P1-9/10 검증: 투표 데이터 무결성
-- ============================================================
-- 옵션 배열 범위를 벗어난 선택
SELECT vr.id, vr.vote_id, vr.selected_options, jsonb_array_length(v.options) AS option_count
FROM public.vote_responses vr
JOIN public.votes v ON v.id = vr.vote_id
WHERE EXISTS (
  SELECT 1 FROM unnest(vr.selected_options) x
  WHERE x < 0 OR x >= jsonb_array_length(v.options)
)
LIMIT 50;

-- 중복 선택 (get_vote_summary 집계를 부풀림)
SELECT vr.id, vr.vote_id, vr.selected_options
FROM public.vote_responses vr
WHERE array_length(vr.selected_options, 1)
      <> (SELECT count(DISTINCT x) FROM unnest(vr.selected_options) x)
LIMIT 50;

-- 빈 배열
SELECT count(*) AS empty_selections
FROM public.vote_responses
WHERE COALESCE(array_length(selected_options, 1), 0) = 0;

-- allow_multiple=false 인데 max_selections>1, 또는 max_selections가 옵션 수 초과
SELECT id, title, allow_multiple, max_selections, jsonb_array_length(options) AS option_count
FROM public.votes
WHERE (allow_multiple = false AND max_selections > 1)
   OR max_selections > jsonb_array_length(options);


-- ============================================================
-- 8. P1-12 검증: bug_reports.report_type 값 분포 (3종 혼재 여부)
-- ============================================================
SELECT report_type, count(*)
FROM public.bug_reports
GROUP BY report_type
ORDER BY count(*) DESC;


-- ============================================================
-- 9. P2 검증: 정리되지 않고 누적되는 행
-- ============================================================
SELECT 'customer_sessions' AS tbl,
       count(*) AS total,
       count(*) FILTER (WHERE expires_at < now())                       AS expired,
       count(*) FILTER (WHERE revoked_at IS NOT NULL)                   AS revoked,
       pg_size_pretty(pg_total_relation_size('public.customer_sessions')) AS size
FROM public.customer_sessions
UNION ALL
SELECT 'ai_guest_sessions',
       count(*),
       count(*) FILTER (WHERE expires_at < now()),
       count(*) FILTER (WHERE revoked_at IS NOT NULL),
       pg_size_pretty(pg_total_relation_size('public.ai_guest_sessions'))
FROM public.ai_guest_sessions
UNION ALL
SELECT 'login_attempt_tracker',
       count(*),
       count(*) FILTER (WHERE lock_expires_at < now()),
       0,
       pg_size_pretty(pg_total_relation_size('public.login_attempt_tracker'))
FROM public.login_attempt_tracker;

-- 무비밀번호 고객 (로그인 시 crypt invalid salt로 500 발생)
SELECT count(*) AS customers_with_empty_password
FROM public.customers
WHERE password = '' AND deleted_at IS NULL;


-- ============================================================
-- 10. 전체 제약/인덱스 인벤토리 (파일 대비 드리프트 확인용)
-- ============================================================
SELECT c.conrelid::regclass AS tbl, c.conname, c.contype,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' AND c.contype IN ('c', 'u', 'p', 'f')
ORDER BY tbl, c.contype, c.conname;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- NOT NULL 없이 남아 있는 컬럼 (의도 확인용)
SELECT c.relname AS tbl, a.attname, format_type(a.atttypid, a.atttypmod) AS typ
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND a.attnum > 0 AND NOT a.attisdropped AND NOT a.attnotnull
ORDER BY c.relname, a.attnum;

-- 인덱스 없는 FK (조인/CASCADE 성능 위험)
SELECT c.conrelid::regclass AS tbl, a.attname AS fk_column
FROM pg_constraint c
JOIN unnest(c.conkey) k(attnum) ON true
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
WHERE c.contype = 'f'
  AND c.connamespace = 'public'::regnamespace
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND i.indkey[0] = a.attnum
  );
