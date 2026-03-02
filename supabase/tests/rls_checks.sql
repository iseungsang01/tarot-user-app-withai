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

-- 5) 로그인 시도 제한 시나리오 점검 (동일 번호 다중 시도 / 분산 시도)
-- 주의: 테스트 DB에서만 실행

do $$
declare
  v_phone text := '010-9999-9999';
  v_result jsonb;
  i integer;
  v_phone_hash text;
begin
  v_phone_hash := encode(extensions.digest(v_phone, 'sha256'), 'hex');

  -- 초기화
  delete from public.login_attempt_tracker where phone_hash = v_phone_hash;

  -- 동일 번호 + 동일 디바이스 실패 누적
  for i in 1..5 loop
    v_result := public.login_customer(v_phone, 'wrong-password', 'ipA-deviceA');
  end loop;

  if coalesce((v_result->>'locked')::boolean, false) is not true then
    raise notice '5회 직후 lock 응답은 다음 시도에 반영될 수 있습니다. 1회 추가 검증 수행';
    v_result := public.login_customer(v_phone, 'wrong-password', 'ipA-deviceA');
  end if;

  if coalesce((v_result->>'locked')::boolean, false) is not true then
    raise exception '동일 번호 다중 시도 잠금 미동작: %', v_result;
  end if;

  -- 동일 번호 + 분산 디바이스 시도 시에도 phone 단위 잠금 공유
  v_result := public.login_customer(v_phone, 'wrong-password', 'ipB-deviceB');
  if coalesce((v_result->>'locked')::boolean, false) is not true then
    raise exception '분산 시도 잠금 미동작: %', v_result;
  end if;

  raise notice '로그인 시도 제한 시나리오 검증 완료';
end
$$;

-- 참고 조회
select phone_hash, ip_device_hash, failed_attempts, lock_expires_at
from public.login_attempt_tracker
order by updated_at desc
limit 10;
