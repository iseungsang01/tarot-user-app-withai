-- Tarot Manager/User App - Supabase final integrated schema
-- Source consolidated from provided integrated SQL plus current customer-app RPC usages.
-- Scope: manager CRUD tables/RLS + customer-session RPCs shared with customer app.
-- Auth model: manager uses Edge Function admin JWT (app_role=admin); customer app uses opaque customer_sessions tokens.
-- Includes current app RPCs: customer auth/profile, visits, coupons, votes, bug reports, and AI guest sessions.
-- Not included: deprecated AI quota tables/RPCs or test data.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  phone_number varchar(13) NOT NULL,
  nickname varchar(20),
  -- Manager-created customers may start without a password; customer signup stores a crypt hash.
  password text NOT NULL DEFAULT '',
  must_change_password boolean NOT NULL DEFAULT false,
  birthday date,
  current_stamps integer NOT NULL DEFAULT 0 CHECK (current_stamps >= 0),
  total_stamps integer NOT NULL DEFAULT 0 CHECK (total_stamps >= 0),
  coupons integer NOT NULL DEFAULT 0 CHECK (coupons >= 0),
  visit_count integer NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  last_visit timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_customers_phone_format CHECK (phone_number ~ '^\d{3}-\d{3,4}-\d{4}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_active
  ON public.customers(phone_number)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.visit_history (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  visit_date timestamptz NOT NULL DEFAULT now(),
  stamp_count integer NOT NULL DEFAULT 1 CHECK (stamp_count > 0),
  is_deleted boolean NOT NULL DEFAULT false,
  is_hidden_by_customer boolean NOT NULL DEFAULT false
);

ALTER TABLE public.visit_history
  ADD COLUMN IF NOT EXISTS stamp_count integer NOT NULL DEFAULT 1 CHECK (stamp_count > 0);
ALTER TABLE public.visit_history
  ADD COLUMN IF NOT EXISTS is_hidden_by_customer boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.coupon_history (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  coupon_code varchar(50) NOT NULL UNIQUE,
  valid_until timestamptz,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  CONSTRAINT chk_coupon_history_status CHECK (
    (used_at IS NULL AND is_used = false)
    OR
    (used_at IS NOT NULL AND is_used = true)
  )
);

CREATE TABLE IF NOT EXISTS public.notices (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title varchar(100) NOT NULL,
  content text NOT NULL,
  image_url text,
  is_pinned boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  title varchar(100) NOT NULL,
  description text NOT NULL,
  report_type varchar(30) NOT NULL DEFAULT '앱 버그',
  screenshot text,
  status varchar(10) NOT NULL DEFAULT '접수' CHECK (status IN ('접수', '확인중', '완료', '보류')),
  created_at timestamptz NOT NULL DEFAULT now(),
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_response text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.votes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title varchar(200) NOT NULL,
  description text,
  options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array'),
  allow_multiple boolean NOT NULL DEFAULT false,
  max_selections smallint NOT NULL DEFAULT 1 CHECK (max_selections >= 1),
  is_anonymous boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vote_responses (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vote_id integer NOT NULL REFERENCES public.votes(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  selected_options integer[] NOT NULL,
  voted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vote_id, customer_id)
);


CREATE INDEX IF NOT EXISTS idx_visit_history_customer
  ON public.visit_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_visit_history_visit_date
  ON public.visit_history(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visit_history_customer_visible
  ON public.visit_history(customer_id, visit_date DESC)
  WHERE is_deleted = false AND is_hidden_by_customer = false;
CREATE INDEX IF NOT EXISTS idx_coupon_history_customer
  ON public.coupon_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_coupon_history_issued_at
  ON public.coupon_history(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_history_valid_until_unused
  ON public.coupon_history(valid_until)
  WHERE is_used = false AND valid_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notices_pinned_published
  ON public.notices(is_pinned DESC, created_at DESC)
  WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_bug_reports_customer
  ON public.bug_reports(customer_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status_created
  ON public.bug_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_created_at
  ON public.votes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_active
  ON public.votes(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vote_responses_vote
  ON public.vote_responses(vote_id);
CREATE INDEX IF NOT EXISTS idx_vote_responses_customer
  ON public.vote_responses(customer_id);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_responses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'app_role', '') = 'admin'
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Required table privileges. RLS below still decides row/operation access.
-- customers 는 빠진다: 매니저 7차가 관리자 JWT 로도 password 해시를 못 읽게
-- 열 단위로 막았다. 여기서 테이블 단위로 다시 주면 그 조치가 되돌아간다.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.visit_history,
  public.coupon_history,
  public.notices,
  public.bug_reports,
  public.votes,
  public.vote_responses
TO authenticated;

GRANT SELECT ON TABLE public.notices, public.votes TO anon;
-- 시퀀스 권한은 매니저 7차가 회수했다. 다시 주지 않는다.

DROP POLICY IF EXISTS "Public can read published notices" ON public.notices;
CREATE POLICY "Public can read published notices"
ON public.notices
FOR SELECT
TO anon, authenticated
USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS "Public can read active votes" ON public.votes;
CREATE POLICY "Public can read active votes"
ON public.votes
FOR SELECT
TO anon, authenticated
USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admin can manage customers" ON public.customers;
CREATE POLICY "Admin can manage customers"
ON public.customers
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can manage visit_history" ON public.visit_history;
CREATE POLICY "Admin can manage visit_history"
ON public.visit_history
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can manage coupon_history" ON public.coupon_history;
CREATE POLICY "Admin can manage coupon_history"
ON public.coupon_history
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can manage notices" ON public.notices;
CREATE POLICY "Admin can manage notices"
ON public.notices
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can manage bug_reports" ON public.bug_reports;
CREATE POLICY "Admin can manage bug_reports"
ON public.bug_reports
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can manage votes" ON public.votes;
CREATE POLICY "Admin can manage votes"
ON public.votes
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can manage vote_responses" ON public.vote_responses;
CREATE POLICY "Admin can manage vote_responses"
ON public.vote_responses
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==========================================
-- Customer App SQL (no migrations required)
-- Keep app customer auth in opaque customer_sessions tokens.
-- ==========================================

CREATE TABLE IF NOT EXISTS public.login_attempt_tracker (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone_hash text NOT NULL,
  ip_device_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  lock_expires_at timestamptz,
  last_failed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_hash, ip_device_hash)
);

CREATE TABLE IF NOT EXISTS public.customer_sessions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.customer_password_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text NOT NULL DEFAULT 'customer',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.ai_guest_sessions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);


CREATE INDEX IF NOT EXISTS idx_login_attempt_tracker_phone_hash ON public.login_attempt_tracker(phone_hash);
CREATE INDEX IF NOT EXISTS idx_login_attempt_tracker_lock_expires_at ON public.login_attempt_tracker(lock_expires_at);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON public.customer_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_valid ON public.customer_sessions(token_hash, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_password_audit_customer ON public.customer_password_audit_logs(customer_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_guest_sessions_valid ON public.ai_guest_sessions(token_hash, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_guest_sessions_expires_at ON public.ai_guest_sessions(expires_at);

ALTER TABLE public.login_attempt_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_password_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_guest_sessions ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "No Direct Access login_attempt_tracker" ON public.login_attempt_tracker;
CREATE POLICY "No Direct Access login_attempt_tracker" ON public.login_attempt_tracker FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No Direct Access customer_sessions" ON public.customer_sessions;
CREATE POLICY "No Direct Access customer_sessions" ON public.customer_sessions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No Direct Access customer_password_audit_logs" ON public.customer_password_audit_logs;
CREATE POLICY "No Direct Access customer_password_audit_logs" ON public.customer_password_audit_logs FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No Direct Access ai_guest_sessions" ON public.ai_guest_sessions;
CREATE POLICY "No Direct Access ai_guest_sessions" ON public.ai_guest_sessions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);


REVOKE ALL ON public.login_attempt_tracker FROM anon, authenticated;
REVOKE ALL ON public.customer_sessions FROM anon, authenticated;
REVOKE ALL ON public.customer_password_audit_logs FROM anon, authenticated;
REVOKE ALL ON public.ai_guest_sessions FROM anon, authenticated;


-- Cleanup for stale functions intentionally not used by the current app.
DROP FUNCTION IF EXISTS public.verify_admin_login(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_admin_settings(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.increment_visit_count(uuid) CASCADE;


-- ── 매니저 소유 공유 함수는 여기 없다 ───────────────────────────────────
-- login_customer, register_customer, validate_password_complexity, submit_bug_report,
-- submit_vote_response, cancel_vote_response, get_vote_summary,
-- resolve_customer_session, resolve_customer_session_allow_restricted 는 매니저앱이 정의한다
-- (정본: tarot-manager-app supabase/sql/20261008_security_round7.sql, 커밋 11ae80c).
-- 이 파일이 옛 본문을 다시 적용하면 NULL 비밀번호 로그인·대입 제한이 되돌아가서 지웠다.
-- 유저앱은 호출만 한다. 정의·DROP·GRANT 를 다시 넣지 않는다.


-- 1.0.9: AI 프록시 사용량은 DB 에서 센다 (migrations/20261008120000_ai_proxy_server_side_quota.sql).
CREATE TABLE IF NOT EXISTS public.ai_proxy_rate_counters (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

ALTER TABLE public.ai_proxy_rate_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No Direct Access ai_proxy_rate_counters" ON public.ai_proxy_rate_counters;
CREATE POLICY "No Direct Access ai_proxy_rate_counters" ON public.ai_proxy_rate_counters FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.ai_proxy_rate_counters FROM anon, authenticated;

-- 이번 창의 카운터를 1 올리고 한도 이내면 true. 거부된 호출도 센다.
CREATE OR REPLACE FUNCTION public.hit_ai_rate_counter(p_bucket text, p_window interval, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_seconds double precision := extract(epoch FROM p_window);
  v_window_start timestamptz;
  v_hits integer;
BEGIN
  v_window_start := to_timestamp(floor(extract(epoch FROM now()) / v_window_seconds) * v_window_seconds);

  INSERT INTO public.ai_proxy_rate_counters AS c (bucket, window_start, hits)
  VALUES (p_bucket, v_window_start, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET hits = c.hits + 1
  RETURNING hits INTO v_hits;

  RETURN v_hits <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.hit_ai_rate_counter(text, interval, integer) FROM PUBLIC, anon, authenticated;

-- ── 2. ai-proxy 한도 (service_role 전용) ──────────────────────────────
-- p_subject 는 resolve_ai_proxy_session 의 user_id(회원 uuid 또는 'guest:<id>').
-- 게스트는 세션을 새로 받으면 개인 한도가 초기화되므로 게스트 전체 일일 한도가
-- 비용 상한 역할을 한다. 통신사 CGNAT 로 여러 사용자가 IP 하나를 공유하니
-- IP 한도는 넉넉하게 둔다.
-- 1.0.10: 오늘의 운세 다시 뽑기는 서버가 광고 시청(AdMob SSV)으로 확인한다
-- (migrations/20261008180000_daily_fortune_ad_reward_ssv.sql).
-- ── 1. 테이블 ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_ad_rewards (
  nonce text PRIMARY KEY,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz,
  transaction_id text UNIQUE,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_ad_rewards_created_at ON public.ai_ad_rewards(created_at);

CREATE TABLE IF NOT EXISTS public.ai_fortune_draws (
  subject text NOT NULL,
  draw_date date NOT NULL,
  draws integer NOT NULL DEFAULT 0,
  PRIMARY KEY (subject, draw_date)
);

ALTER TABLE public.ai_ad_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_fortune_draws ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No Direct Access ai_ad_rewards" ON public.ai_ad_rewards;
CREATE POLICY "No Direct Access ai_ad_rewards" ON public.ai_ad_rewards FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "No Direct Access ai_fortune_draws" ON public.ai_fortune_draws;
CREATE POLICY "No Direct Access ai_fortune_draws" ON public.ai_fortune_draws FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.ai_ad_rewards, public.ai_fortune_draws FROM anon, authenticated;

-- ── 2. nonce 발급 (service_role 전용, ai-proxy 가 부른다) ─────────────
-- 주체당 하루 30개. 광고를 안 보면 nonce 는 쓸모가 없으니 행이 쌓이는 것만 막는다.
CREATE OR REPLACE FUNCTION public.issue_ad_reward_nonce(p_subject text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_nonce text;
BEGIN
  IF p_subject IS NULL OR length(p_subject) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_SUBJECT');
  END IF;

  IF NOT public.hit_ai_rate_counter('ad_nonce:' || p_subject, interval '1 day', 30) THEN
    RETURN jsonb_build_object('success', false, 'code', 'AD_NONCE_LIMITED');
  END IF;

  v_nonce := encode(extensions.gen_random_bytes(16), 'hex');
  INSERT INTO public.ai_ad_rewards (nonce, subject) VALUES (v_nonce, p_subject);

  IF random() < 0.01 THEN
    DELETE FROM public.ai_ad_rewards WHERE created_at < now() - interval '3 days';
    DELETE FROM public.ai_fortune_draws WHERE draw_date < (now() AT TIME ZONE 'Asia/Seoul')::date - 3;
  END IF;

  RETURN jsonb_build_object('success', true, 'nonce', v_nonce);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_ad_reward_nonce(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_ad_reward_nonce(text) TO service_role;

-- ── 3. 보상 기록 (service_role 전용, admob-ssv 가 서명 검증 후 부른다) ──
-- 같은 transaction_id 재전송(구글 재시도·리플레이)은 한 번만 반영한다.
CREATE OR REPLACE FUNCTION public.record_ad_reward(p_nonce text, p_transaction_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_nonce IS NULL OR p_transaction_id IS NULL OR length(p_transaction_id) = 0 THEN
    RETURN false;
  END IF;

  UPDATE public.ai_ad_rewards
  SET rewarded_at = now(), transaction_id = p_transaction_id
  WHERE nonce = p_nonce
    AND rewarded_at IS NULL
    AND created_at > now() - interval '1 hour'
    AND NOT EXISTS (SELECT 1 FROM public.ai_ad_rewards r WHERE r.transaction_id = p_transaction_id);

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.record_ad_reward(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ad_reward(text, text) TO service_role;

-- ── 4. consume_ai_proxy_quota: 오늘의 운세 뽑기 규칙 추가 ─────────────
-- 인자가 늘어서 옛 2인자 판을 지운다. 둘 다 있으면 이름 붙인 2인자 호출이 모호해진다.
DROP FUNCTION IF EXISTS public.consume_ai_proxy_quota(text, text);

CREATE OR REPLACE FUNCTION public.consume_ai_proxy_quota(
  p_subject text,
  p_client_ip text DEFAULT NULL,
  p_task text DEFAULT NULL,
  p_ad_nonce text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_guest boolean := p_subject LIKE 'guest:%';
  v_is_fortune boolean := p_task = 'getDailyFortune';
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_draws integer := 0;
  v_reward public.ai_ad_rewards%ROWTYPE;
BEGIN
  IF p_subject IS NULL OR length(p_subject) = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_subject');
  END IF;

  -- 오늘의 운세: 오늘(KST) 첫 뽑기는 무료, 그다음부터는 보상된 광고 nonce 가 필요하다.
  -- 광고 판정은 한도 카운터보다 먼저 한다. 콜백 대기 중 재시도가 AI 한도를 깎지 않게.
  IF v_is_fortune THEN
    INSERT INTO public.ai_fortune_draws (subject, draw_date) VALUES (p_subject, v_today)
    ON CONFLICT (subject, draw_date) DO NOTHING;
    SELECT draws INTO v_draws FROM public.ai_fortune_draws
    WHERE subject = p_subject AND draw_date = v_today
    FOR UPDATE;

    IF v_draws >= 1 THEN
      IF p_ad_nonce IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'ad_required');
      END IF;

      SELECT * INTO v_reward FROM public.ai_ad_rewards
      WHERE nonce = p_ad_nonce AND subject = p_subject AND consumed_at IS NULL
        AND created_at > now() - interval '1 hour'
      FOR UPDATE;

      IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'ad_required');
      END IF;
      IF v_reward.rewarded_at IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'ad_pending');
      END IF;
    END IF;
  END IF;

  IF NOT public.hit_ai_rate_counter('subject:' || p_subject || ':minute', interval '1 minute', 6) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subject_minute');
  END IF;

  IF NOT public.hit_ai_rate_counter('subject:' || p_subject || ':day', interval '1 day',
                                    CASE WHEN v_is_guest THEN 20 ELSE 60 END) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subject_day');
  END IF;

  IF COALESCE(p_client_ip, '') <> ''
     AND NOT public.hit_ai_rate_counter('ip:' || p_client_ip || ':minute', interval '1 minute', 30) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'ip_minute');
  END IF;

  -- 전체 상한이 비용 상한이다. 게스트는 세션을 새로 받으면, 회원은 가입을 새로 하면
  -- 개인 한도가 초기화된다.
  IF v_is_guest AND NOT public.hit_ai_rate_counter('guests:day', interval '1 day', 2000) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'guests_day');
  END IF;

  IF NOT v_is_guest AND NOT public.hit_ai_rate_counter('members:day', interval '1 day', 5000) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'members_day');
  END IF;

  -- 한도를 모두 통과했을 때만 뽑기·광고 보상을 소모한다.
  IF v_is_fortune THEN
    IF v_draws >= 1 THEN
      UPDATE public.ai_ad_rewards SET consumed_at = now() WHERE nonce = p_ad_nonce;
    END IF;
    UPDATE public.ai_fortune_draws SET draws = draws + 1
    WHERE subject = p_subject AND draw_date = v_today;
  END IF;

  -- 지난 창은 가끔 지운다. 일일 창이 가장 길어서 2일이면 충분하다.
  IF random() < 0.01 THEN
    DELETE FROM public.ai_proxy_rate_counters WHERE window_start < now() - interval '2 days';
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_proxy_quota(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_proxy_quota(text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.issue_ai_guest_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session_token text;
  v_expires_at timestamptz := now() + interval '1 day';
  v_client_ip text;
  v_headers json;
BEGIN
  v_headers := NULLIF(current_setting('request.headers', true), '')::json;
  v_client_ip := COALESCE(
    NULLIF(btrim(v_headers ->> 'cf-connecting-ip'), ''),
    NULLIF(btrim(split_part(COALESCE(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''));

  IF (v_client_ip IS NOT NULL
      AND NOT public.hit_ai_rate_counter('guest_issue:ip:' || left(v_client_ip, 64), interval '1 hour', 10))
     OR NOT public.hit_ai_rate_counter('guest_issue:all', interval '1 hour', 300) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'GUEST_RATE_LIMITED',
      'message', '게스트 로그인 요청이 많습니다. 잠시 후 다시 시도해주세요.'
    );
  END IF;

  v_session_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.ai_guest_sessions (token_hash, expires_at, last_used_at)
  VALUES (encode(extensions.digest(v_session_token, 'sha256'), 'hex'), v_expires_at, now());

  RETURN jsonb_build_object(
    'success', true,
    'session_token', v_session_token,
    'expires_at', v_expires_at,
    'guest', jsonb_build_object(
      'id', 'guest',
      'nickname', '게스트',
      'isGuest', true,
      'current_stamps', 0,
      'visit_count', 0
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_ai_proxy_session(p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_token_hash text;
  v_guest_session_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'user_id', v_customer_id::text, 'is_guest', false);
  END IF;

  IF p_session_token IS NULL OR length(trim(p_session_token)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired session.');
  END IF;

  v_token_hash := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

  SELECT id INTO v_guest_session_id
  FROM public.ai_guest_sessions
  WHERE token_hash = v_token_hash
    AND revoked_at IS NULL
    AND expires_at > now();

  IF v_guest_session_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired session.');
  END IF;

  UPDATE public.ai_guest_sessions SET last_used_at = now() WHERE id = v_guest_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', 'guest:' || v_guest_session_id::text,
    'is_guest', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.logout_ai_guest_session(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.ai_guest_sessions
  SET revoked_at = now()
  WHERE token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND revoked_at IS NULL;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile(p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_customer public.customers%ROWTYPE; v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session_allow_restricted(p_session_token);
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired session.');
  END IF;
  SELECT * INTO v_customer FROM public.customers WHERE id = v_customer_id AND deleted_at IS NULL;
  RETURN jsonb_build_object('success', true, 'customer', to_jsonb(v_customer) - 'password');
END;
$$;

CREATE OR REPLACE FUNCTION public.logout_customer(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.customer_sessions
  SET revoked_at = now()
  WHERE token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex') AND revoked_at IS NULL;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_stats(p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_customer public.customers%ROWTYPE; v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Invalid or expired session.'); END IF;
  SELECT * INTO v_customer FROM public.customers WHERE id = v_customer_id;
  RETURN jsonb_build_object('success', true, 'current_stamps', COALESCE(v_customer.current_stamps, 0), 'visit_count', COALESCE(v_customer.visit_count, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_visits(p_session_token text)
RETURNS TABLE (
  id integer,
  customer_id uuid,
  visit_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT vh.id, vh.customer_id, vh.visit_date
  FROM public.visit_history AS vh
  WHERE vh.customer_id = v_customer_id
    AND vh.is_deleted = false
    AND vh.is_hidden_by_customer = false
  ORDER BY vh.visit_date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_visit(p_session_token text, p_visit_id integer)
RETURNS TABLE (
  id integer,
  customer_id uuid,
  visit_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT vh.id, vh.customer_id, vh.visit_date
  FROM public.visit_history AS vh
  WHERE vh.id = p_visit_id
    AND vh.customer_id = v_customer_id
    AND vh.is_deleted = false
    AND vh.is_hidden_by_customer = false;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_visits(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_visit(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_visits(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_visit(text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.hide_my_visit(p_session_token text, p_visit_id integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000';
  END IF;

  UPDATE public.visit_history AS vh
  SET is_hidden_by_customer = true
  WHERE vh.id = p_visit_id
    AND vh.customer_id = v_customer_id
    AND vh.is_deleted = false
    AND vh.is_hidden_by_customer = false;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.hide_my_visit(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hide_my_visit(text, integer) TO anon, authenticated;

-- uuid 기반 계정 조작 RPC 5개(update_my_nickname / delete_my_account(uuid) /
-- soft_delete_customer / verify_password / update_customer_password)는 삭제했다.
-- 세션 검증 없이 anon 에 노출돼 uuid 만 알면 타인 계정을 조작할 수 있었다.
-- 대체 경로는 전부 세션 토큰판이다: update_my_password, verify_my_password,
-- delete_my_account(text, text).
-- 매니저 앱이 DROP 하기 전에 유저앱이 먼저 GRANT 를 걷어내야 원복되지 않는다.
-- 근거: docs/manager-app-db-issues.md §2, 매니저 회신 §2.

CREATE OR REPLACE FUNCTION public.get_my_coupons(p_session_token text, p_valid_only boolean DEFAULT false)
RETURNS SETOF public.coupon_history LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000'; END IF;
  RETURN QUERY SELECT * FROM public.coupon_history ch
  WHERE ch.customer_id = v_customer_id AND ch.is_used = false AND (NOT p_valid_only OR ch.valid_until IS NULL OR ch.valid_until >= now())
  ORDER BY ch.issued_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_coupon_count(p_session_token text, p_valid_only boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_customer_id uuid; v_count integer;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000'; END IF;
  SELECT count(*)::integer INTO v_count FROM public.coupon_history ch
  WHERE ch.customer_id = v_customer_id AND ch.is_used = false AND (NOT p_valid_only OR ch.valid_until IS NULL OR ch.valid_until >= now());
  RETURN COALESCE(v_count, 0);
END;
$$;



CREATE OR REPLACE FUNCTION public.get_my_vote_responses(p_session_token text)
RETURNS SETOF public.vote_responses LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000'; END IF;
  RETURN QUERY SELECT * FROM public.vote_responses vr WHERE vr.customer_id = v_customer_id ORDER BY vr.voted_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_vote_response(p_session_token text, p_vote_id integer)
RETURNS public.vote_responses LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_customer_id uuid; v_response public.vote_responses%ROWTYPE;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_response FROM public.vote_responses WHERE vote_id = p_vote_id AND customer_id = v_customer_id;
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_bug_reports(p_session_token text)
RETURNS SETOF public.bug_reports LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000'; END IF;
  RETURN QUERY SELECT * FROM public.bug_reports br WHERE br.customer_id = v_customer_id ORDER BY br.created_at DESC;
END;
$$;


GRANT EXECUTE ON FUNCTION public.issue_ai_guest_session() TO anon, authenticated;
-- resolve_ai_proxy_session 은 ai-proxy(service_role)만 부른다.
REVOKE ALL ON FUNCTION public.resolve_ai_proxy_session(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_ai_proxy_session(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.logout_ai_guest_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.logout_customer(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_stats(text) TO anon, authenticated;
-- uuid 기반 5개 함수의 GRANT 는 삭제했다(위 정의 삭제와 한 쌍).
-- 이 줄이 남아 있으면 스키마를 한 번만 다시 적용해도 매니저의 DROP 이 원복된다.

-- 1.0.6: session-token based sensitive customer account operations.
CREATE OR REPLACE FUNCTION public.verify_my_password(p_session_token text, input_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_hashed_password text;
BEGIN
  v_customer_id := public.resolve_customer_session_allow_restricted(p_session_token);
  IF v_customer_id IS NULL OR input_password IS NULL OR input_password = '' THEN
    RETURN false;
  END IF;

  IF NOT public.hit_ai_rate_counter('reauth:' || v_customer_id::text, interval '1 hour', 10) THEN
    RETURN false;
  END IF;

  SELECT password INTO v_hashed_password
  FROM public.customers
  WHERE id = v_customer_id AND deleted_at IS NULL;

  RETURN COALESCE(v_hashed_password = extensions.crypt(input_password, v_hashed_password), false);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_password(p_session_token text, current_password text, new_password text, p_reason text DEFAULT 'settings_change')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session_allow_restricted(p_session_token);
  IF v_customer_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT COALESCE(public.verify_my_password(p_session_token, current_password), false) THEN
    RETURN false;
  END IF;

  IF NOT COALESCE(public.validate_password_complexity(new_password), false) THEN
    RAISE EXCEPTION 'Password does not meet the policy.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.customers
  SET password = extensions.crypt(new_password, extensions.gen_salt('bf')), must_change_password = false
  WHERE id = v_customer_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.customer_sessions
  SET revoked_at = now()
  WHERE customer_id = v_customer_id
    AND revoked_at IS NULL
    AND token_hash <> encode(extensions.digest(p_session_token, 'sha256'), 'hex');

  INSERT INTO public.customer_password_audit_logs (customer_id, changed_by, reason, metadata)
  VALUES (v_customer_id, 'customer', left(COALESCE(p_reason, 'settings_change'), 50),
          jsonb_build_object('source', 'update_my_password'));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_account(p_session_token text, input_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT COALESCE(public.verify_my_password(p_session_token, input_password), false) THEN
    RETURN false;
  END IF;

  -- 식별정보를 지우고 비활성화한다. '_deleted_' 접미사를 붙이던 옛 방식은
  -- varchar(13) 초과(22001)로 탈퇴가 항상 실패했다. 000-0000-0000 은 12자라
  -- 길이에 맞고 chk_customers_phone_format('^\d{3}-\d{3,4}-\d{4}$')도 통과한다.
  -- 탈퇴 행이 여럿 같은 값이어도 idx_customers_phone_active 가
  -- WHERE deleted_at IS NULL 부분 인덱스라 충돌하지 않고, 원래 번호는 풀려서
  -- 같은 번호로 재가입도 된다.
  UPDATE public.customers
  SET deleted_at = now(),
      phone_number = '000-0000-0000',
      nickname = NULL,
      birthday = NULL
  WHERE id = v_customer_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.customer_sessions
  SET revoked_at = now()
  WHERE customer_id = v_customer_id AND revoked_at IS NULL;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_my_password(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_password(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text, text) TO anon, authenticated;

-- 1.0.8: AI 게스트 세션 정리. issue_ai_guest_session 이 anon 에 무제한 공개라
-- 호출당 행이 1개씩 쌓이고 만료 후에도 삭제되지 않는다.
-- 운영자(service_role/postgres)가 주기 실행한다. 클라이언트 롤에는 노출하지 않는다.
CREATE OR REPLACE FUNCTION public.cleanup_ai_guest_sessions(p_retention interval DEFAULT interval '7 days')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.ai_guest_sessions
  WHERE expires_at < now() - p_retention
     OR (revoked_at IS NOT NULL AND revoked_at < now() - p_retention);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_ai_guest_sessions(interval) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_coupons(text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_coupon_count(text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_vote_responses(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_vote_response(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_bug_reports(text) TO anon, authenticated;
