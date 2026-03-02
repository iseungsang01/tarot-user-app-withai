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

insert into public.customers (id, phone_number, password, nickname)
values
  ('11111111-1111-1111-1111-111111111111', '010-1111-1111', crypt('pw', gen_salt('bf')), 'owner_a'),
  ('22222222-2222-2222-2222-222222222222', '010-2222-2222', crypt('pw', gen_salt('bf')), 'owner_b')
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
rollback;
