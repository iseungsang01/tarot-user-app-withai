-- RLS 검증용 샘플 테스트 스크립트
-- 사용 예: supabase db remote commit 또는 psql로 수동 실행

-- 1) RLS 활성화 여부 점검
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('customers', 'coupon_history', 'visit_history');

-- 2) 정책 목록 확인
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('customers', 'coupon_history', 'visit_history')
order by tablename, policyname;

-- 3) anon/authenticated 접근 동작 점검 예시
-- 주의: 아래 쿼리는 로컬/테스트 DB에서만 실행하세요.
-- 실제 UID 값은 테스트 사용자 ID로 교체 필요.

-- 3-1) anon 역할 시 조회 제한 확인
set local role anon;
select count(*) as anon_customers_visible from public.customers;

-- 3-2) authenticated 역할 시 조회/쓰기 제한 확인
set local role authenticated;
select count(*) as auth_customers_visible from public.customers;

-- 예시 insert (정책에 따라 실패/성공 여부 확인)
-- insert into public.visit_history (customer_id, visit_date, card_review)
-- values ('00000000-0000-0000-0000-000000000000', now(), 'rls test');

reset role;
