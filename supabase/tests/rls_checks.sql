-- 앱 변경사항 기준 점검 스크립트
-- 요구사항: 멤버십/AI 사용량 제거, 공지 이미지/버그 스크린샷 반영

-- 1) 주요 테이블 RLS 및 정책 확인
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

-- 2) 공지/버그 첨부 컬럼 점검
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'notices' and column_name in ('image_url'))
    or
    (table_name = 'bug_reports' and column_name in ('screenshot', 'report_type'))
  )
order by table_name, column_name;

-- 3) report_type 데이터 정리 (앱 버그 고정)
-- 2) bug_reports에 스크린샷 컬럼이 없으면 추가
alter table if exists public.bug_reports
  add column if not exists screenshot text;

-- 3) 운영 정책상 report_type은 앱 버그 고정 사용
update public.bug_reports
set report_type = '어플 버그'
where report_type is distinct from '어플 버그';

-- 4) 멤버십/AI 사용량 함수 제거 확인
-- 결과가 없으면 정상
select proname
from pg_proc
where proname = 'increment_ai_usage';
-- 4) AI 사용량 로직 비활성화 이후 참조 함수 확인(수동 점검)
-- drop function if exists public.increment_ai_usage(uuid);
