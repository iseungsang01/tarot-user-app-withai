-- 앱 변경사항 기준 점검 스크립트
-- 1) 공지/버그 리포트 중심으로 RLS 및 정책 확인
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('customers', 'visit_history', 'notices', 'bug_reports');

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('customers', 'visit_history', 'notices', 'bug_reports')
order by tablename, policyname;

-- 2) bug_reports에 스크린샷 컬럼이 없으면 추가
alter table if exists public.bug_reports
  add column if not exists screenshot text;

-- 3) 운영 정책상 report_type은 앱 버그 고정 사용
update public.bug_reports
set report_type = '어플 버그'
where report_type is distinct from '어플 버그';

-- 4) AI 사용량 로직 비활성화 이후 참조 함수 확인(수동 점검)
-- drop function if exists public.increment_ai_usage(uuid);
