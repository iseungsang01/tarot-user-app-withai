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

-- 3) TODO: anon/authenticated 역할로 각각 접근 테스트 추가
