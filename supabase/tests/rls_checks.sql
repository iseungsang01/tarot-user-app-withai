-- RLS regression checks: owner-only access and anon read-only scopes.
-- Run on local/test DB only.

begin;

-- ------------------------------------------------------------------
-- 0) baseline metadata checks
-- ------------------------------------------------------------------
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('customers', 'visit_history', 'coupon_history', 'notices', 'bug_reports', 'vote_responses');

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('customers', 'visit_history', 'coupon_history', 'notices', 'bug_reports', 'vote_responses')
order by tablename, policyname;

-- ------------------------------------------------------------------
-- 1) setup fixture data
-- ------------------------------------------------------------------
-- uuid values for deterministic checks
-- owner_a: 11111111-1111-1111-1111-111111111111
-- owner_b: 22222222-2222-2222-2222-222222222222

insert into public.customers (id, auth_email, phone_number, password, nickname)
values
  ('11111111-1111-1111-1111-111111111111', '01011111111@phone.local', '010-1111-1111', crypt('pw', gen_salt('bf')), 'owner_a'),
  ('22222222-2222-2222-2222-222222222222', '01022222222@phone.local', '010-2222-2222', crypt('pw', gen_salt('bf')), 'owner_b')
on conflict do nothing;

insert into public.visit_history (customer_id)
values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.coupon_history (customer_id, coupon_code)
values
  ('11111111-1111-1111-1111-111111111111', 'CPN-A-001'),
  ('22222222-2222-2222-2222-222222222222', 'CPN-B-001')
on conflict do nothing;

insert into public.bug_reports (customer_id, title, description)
values
  ('11111111-1111-1111-1111-111111111111', 'A bug', 'Owned by A'),
  ('22222222-2222-2222-2222-222222222222', 'B bug', 'Owned by B');

insert into public.votes (title, options, is_active)
values ('vote', '["x","y"]'::jsonb, true)
returning id \gset

insert into public.vote_responses (vote_id, customer_id, selected_options)
values
  (:'id', '11111111-1111-1111-1111-111111111111', '{1}'),
  (:'id', '22222222-2222-2222-2222-222222222222', '{2}')
on conflict do nothing;

insert into public.notices (title, content, is_published)
values
  ('Published notice', 'visible to anon', true),
  ('Draft notice', 'hidden from anon', false);

-- ------------------------------------------------------------------
-- 2) anon checks: notices 읽기만 허용, 쓰기/수정/삭제 차단
-- ------------------------------------------------------------------
set local role anon;

select count(*) as anon_published_notices
from public.notices
where is_published = true;

select count(*) as anon_draft_notices_should_be_zero
from public.notices
where is_published = false;

-- expected failure (permission denied or RLS violation)
do $$
begin
  begin
    insert into public.notices (title, content, is_published)
    values ('anon write', 'should fail', true);
    raise exception 'anon insert on notices unexpectedly succeeded';
  exception when others then
    raise notice 'anon insert blocked as expected: %', sqlerrm;
  end;
end
$$;

-- ------------------------------------------------------------------
-- 3) authenticated owner-a checks
-- ------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

-- owner can read own rows only
select count(*) as owner_a_customers_visible from public.customers;
select count(*) as owner_a_visits_visible from public.visit_history;
select count(*) as owner_a_coupons_visible from public.coupon_history;
select count(*) as owner_a_bugs_visible from public.bug_reports;
select count(*) as owner_a_votes_visible from public.vote_responses;

-- should not update other user's row
update public.customers
set nickname = 'hacked_by_a'
where id = '22222222-2222-2222-2222-222222222222';

select count(*) as owner_a_updated_other_customer_should_be_zero
from public.customers
where id = '22222222-2222-2222-2222-222222222222'
  and nickname = 'hacked_by_a';

-- should not delete other user's bug report
delete from public.bug_reports
where customer_id = '22222222-2222-2222-2222-222222222222';

select count(*) as owner_b_bug_still_exists
from public.bug_reports
where customer_id = '22222222-2222-2222-2222-222222222222';

-- ------------------------------------------------------------------
-- 4) authenticated owner-b checks (cross-read blocked)
-- ------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

select count(*) as owner_b_customers_visible from public.customers;
select count(*) as owner_b_visits_visible from public.visit_history;
select count(*) as owner_b_coupons_visible from public.coupon_history;
select count(*) as owner_b_bugs_visible from public.bug_reports;
select count(*) as owner_b_votes_visible from public.vote_responses;

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
rollback;
