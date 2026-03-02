-- ==========================================
-- Tarot Drawer - Supabase Schema
-- [최종 통합 버전 - 초기 설치용]
-- ==========================================

-- ==========================================
-- 1. 초기화 및 확장 모듈 설정
-- ==========================================

-- 암호화 및 UUID 생성을 위한 pgcrypto 확장 설치
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 권한 부여
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;

-- 기본 권한 설정 (최소 권한)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- ==========================================
-- 2. 테이블 생성
-- ==========================================

-- [고객 테이블]
CREATE TABLE public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number varchar(13) NOT NULL,
    nickname varchar(20),
    password text NOT NULL,
    must_change_password boolean NOT NULL DEFAULT false,
    birthday date,

    current_stamps integer DEFAULT 0 CHECK (current_stamps >= 0),
    total_stamps integer DEFAULT 0 CHECK (total_stamps >= 0),
    coupons integer DEFAULT 0 CHECK (coupons >= 0),

    visit_count integer DEFAULT 0 CHECK (visit_count >= 0),
    last_visit timestamptz DEFAULT NOW(),
    created_at timestamptz DEFAULT NOW(),
    deleted_at timestamptz,

    CONSTRAINT chk_phone_format CHECK (phone_number ~ '^\d{3}-\d{3,4}-\d{4}$')
);

-- 유효 유저 중 전화번호 유니크 제한
CREATE UNIQUE INDEX idx_customers_phone_active ON customers(phone_number) WHERE deleted_at IS NULL;

-- [방문 및 스탬프 적립 이력]
CREATE TABLE public.visit_history (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    visit_date timestamptz DEFAULT NOW(),
    is_deleted boolean DEFAULT FALSE
);

-- [쿠폰 이력]
CREATE TABLE public.coupon_history (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    issued_at timestamptz DEFAULT NOW(),
    coupon_code varchar(50) NOT NULL UNIQUE,
    valid_until timestamptz,
    is_used boolean DEFAULT false,
    used_at timestamptz,
    CONSTRAINT chk_coupon_status CHECK (
      (used_at IS NULL AND is_used = false)
      OR
      (used_at IS NOT NULL AND is_used = true)
    )
);

-- [공지사항]
CREATE TABLE public.notices (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title varchar(100) NOT NULL,
    content text NOT NULL,
    image_url text,
    is_pinned boolean DEFAULT false,
    is_published boolean DEFAULT true,
    created_at timestamptz DEFAULT NOW()
);

-- [버그 리포트]
CREATE TABLE public.bug_reports (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    title varchar(100) NOT NULL,
    description text NOT NULL,
    report_type varchar(30) NOT NULL DEFAULT '어플 버그' CHECK (report_type = '어플 버그'),
    screenshot text,
    status varchar(10) DEFAULT '접수' CHECK (status IN ('접수', '확인중', '완료', '보류')),
    created_at timestamptz DEFAULT NOW(),
    device_info jsonb DEFAULT '{}'::jsonb,
    admin_response text DEFAULT ''
);

-- [투표 기능]
CREATE TABLE public.votes (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title varchar(200) NOT NULL,
    description text,
    options jsonb NOT NULL,
    allow_multiple boolean DEFAULT false,
    max_selections smallint DEFAULT 1,
    is_anonymous boolean DEFAULT true,
    is_active boolean DEFAULT true,
    starts_at timestamptz DEFAULT NOW(),
    ends_at timestamptz,
    created_at timestamptz DEFAULT NOW()
);

-- [투표 응답]
CREATE TABLE public.vote_responses (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vote_id integer NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    selected_options integer[] NOT NULL,
    voted_at timestamptz DEFAULT NOW(),
    UNIQUE(vote_id, customer_id)
);

-- [환경 설정 테이블]
CREATE TABLE public.app_configs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- [비밀번호 변경 감사 로그]
CREATE TABLE public.customer_password_audit_logs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    changed_at timestamptz NOT NULL DEFAULT NOW(),
    changed_by text NOT NULL DEFAULT 'customer',
    reason text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ==========================================
-- 3. 인덱스 설정 (최적화)
-- ==========================================
CREATE INDEX idx_visit_history_customer ON visit_history(customer_id);
CREATE INDEX idx_coupon_history_customer ON coupon_history(customer_id);
CREATE INDEX idx_bug_reports_customer ON bug_reports(customer_id);
CREATE INDEX idx_vote_responses_customer ON vote_responses(customer_id);
CREATE INDEX idx_notices_pinned_published ON notices(is_pinned, is_published) WHERE is_published = true;
CREATE INDEX idx_customer_password_audit_customer ON customer_password_audit_logs(customer_id, changed_at DESC);

-- ==========================================
-- 4. RLS (Row Level Security) 설정
-- ==========================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_password_audit_logs ENABLE ROW LEVEL SECURITY;

-- 고객 정보: 본인 데이터만 접근 가능
CREATE POLICY "Customers can view own profile" ON customers
FOR SELECT USING (id = auth.uid());
CREATE POLICY "Customers can insert own profile" ON customers
FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Customers can update own profile" ON customers
FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Customers can delete own profile" ON customers
FOR DELETE USING (id = auth.uid());

-- 방문 이력: 본인 데이터만 접근 가능
CREATE POLICY "Visit history owner select" ON visit_history
FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Visit history owner insert" ON visit_history
FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Visit history owner update" ON visit_history
FOR UPDATE USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Visit history owner delete" ON visit_history
FOR DELETE USING (customer_id = auth.uid());

-- 쿠폰 이력: 본인 데이터만 접근 가능
CREATE POLICY "Coupon history owner select" ON coupon_history
FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Coupon history owner insert" ON coupon_history
FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Coupon history owner update" ON coupon_history
FOR UPDATE USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Coupon history owner delete" ON coupon_history
FOR DELETE USING (customer_id = auth.uid());

-- 공지사항: anon 포함 공개 읽기만 허용
CREATE POLICY "Public can read published notices" ON notices
FOR SELECT TO anon, authenticated USING (is_published = true);

-- 버그 리포트: 본인 데이터만 접근 가능
CREATE POLICY "Bug reports owner select" ON bug_reports
FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Bug reports owner insert" ON bug_reports
FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Bug reports owner update" ON bug_reports
FOR UPDATE USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Bug reports owner delete" ON bug_reports
FOR DELETE USING (customer_id = auth.uid());

-- 투표: 읽기 전용 공개
CREATE POLICY "Public can read active votes" ON votes
FOR SELECT TO anon, authenticated USING (is_active = true);

-- 투표 응답: 본인 데이터만 접근 가능
CREATE POLICY "Vote responses owner select" ON vote_responses
FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Vote responses owner insert" ON vote_responses
FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Vote responses owner update" ON vote_responses
FOR UPDATE USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Vote responses owner delete" ON vote_responses
FOR DELETE USING (customer_id = auth.uid());

CREATE POLICY "Allow Read Configs" ON app_configs FOR SELECT USING (true);
CREATE POLICY "Allow All Select" ON customer_password_audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow All Insert" ON customer_password_audit_logs FOR INSERT WITH CHECK (true);

-- ==========================================
-- 4.1 비밀번호 정책 함수
-- ==========================================
CREATE OR REPLACE FUNCTION public.validate_password_complexity(p_password text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_password IS NULL THEN
    RETURN false;
  END IF;

  RETURN (
    char_length(p_password) >= 8
    AND p_password ~ '[A-Z]'
    AND p_password ~ '[a-z]'
    AND p_password ~ '[0-9]'
    AND p_password ~ '[^A-Za-z0-9]'
  );
END;
$$;

-- ==========================================
-- 5. RPC 함수 (Security Definer)
-- ==========================================

-- [기능] 닉네임 변경
CREATE OR REPLACE FUNCTION public.update_my_nickname(
    p_id uuid,
    p_new_nickname text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.customers SET nickname = p_new_nickname WHERE id = p_id;
    RETURN FOUND;
END;
$$;

-- [기능] 회원 탈퇴 (Soft Delete)
CREATE OR REPLACE FUNCTION public.delete_my_account(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.customers
    SET deleted_at = NOW(),
        phone_number = phone_number || '_deleted_' || substring(md5(random()::text) from 1 for 5)
    WHERE id = p_id;
    RETURN FOUND;
END;
$$;

-- [기능] 방문 횟수 증가
CREATE OR REPLACE FUNCTION public.increment_visit_count(target_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.customers
  SET 
    visit_count = COALESCE(visit_count, 0) + 1,
    last_visit = NOW()
  WHERE id = target_customer_id;
END;
$$;

-- [기능] 관리자 비밀번호 검증
CREATE OR REPLACE FUNCTION public.verify_admin_password(p_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_hashed_password TEXT;
BEGIN
  SELECT value INTO v_hashed_password FROM public.app_configs WHERE key = 'admin_password';
  RETURN v_hashed_password = extensions.crypt(p_password, v_hashed_password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [기능] 관리자 로그인 검증
CREATE OR REPLACE FUNCTION public.verify_admin_login(p_id TEXT, p_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_stored_id TEXT;
  v_hashed_password TEXT;
BEGIN
  SELECT value INTO v_stored_id FROM public.app_configs WHERE key = 'admin_id';
  SELECT value INTO v_hashed_password FROM public.app_configs WHERE key = 'admin_password';
  
  RETURN (v_stored_id = p_id) AND (v_hashed_password = extensions.crypt(p_password, v_hashed_password));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [기능] 관리자 설정 업데이트
CREATE OR REPLACE FUNCTION public.update_admin_settings(p_current_password TEXT, p_new_id TEXT, p_new_password TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_hashed_password TEXT;
BEGIN
  SELECT value INTO v_hashed_password FROM public.app_configs WHERE key = 'admin_password';
  
  IF v_hashed_password = extensions.crypt(p_current_password, v_hashed_password) THEN
    IF p_new_id IS NOT NULL AND p_new_id <> '' THEN
      UPDATE public.app_configs SET value = p_new_id, updated_at = NOW() WHERE key = 'admin_id';
    END IF;
    
    IF p_new_password IS NOT NULL AND p_new_password <> '' THEN
      UPDATE public.app_configs SET value = extensions.crypt(p_new_password, extensions.gen_salt('bf')), updated_at = NOW() WHERE key = 'admin_password';
    END IF;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [기능] 고객 회원가입
CREATE OR REPLACE FUNCTION public.register_customer(
    p_phone text,
    p_password text,
    p_nickname text DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_customer_id uuid;
    v_nickname text;
BEGIN
    -- 전화번호 형식 검증
    IF p_phone !~ '^\d{3}-\d{3,4}-\d{4}$' THEN
        RETURN jsonb_build_object('success', false, 'message', '전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)');
    END IF;

    -- 중복 체크
    IF EXISTS (SELECT 1 FROM public.customers WHERE phone_number = p_phone AND deleted_at IS NULL) THEN
        RETURN jsonb_build_object('success', false, 'message', '이미 가입된 전화번호입니다.');
    END IF;

    IF NOT public.validate_password_complexity(p_password) THEN
        RETURN jsonb_build_object('success', false, 'message', '비밀번호는 8자 이상, 영문 대/소문자, 숫자, 특수문자를 포함해야 합니다.');
    END IF;

    v_nickname := COALESCE(NULLIF(p_nickname, ''), '유저_' || right(p_phone, 4));

    -- 데이터 삽입
    INSERT INTO public.customers (phone_number, password, nickname, must_change_password)
    VALUES (p_phone, extensions.crypt(p_password, extensions.gen_salt('bf')), v_nickname, false)
    RETURNING id INTO v_customer_id;

    RETURN jsonb_build_object('success', true, 'id', v_customer_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', '회원가입 에러: ' || SQLERRM);
END;
$$;

-- [기능] 고객 로그인
CREATE OR REPLACE FUNCTION public.login_customer(
    p_phone text,
    p_password text
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_customer public.customers%ROWTYPE;
BEGIN
    SELECT * INTO v_customer
    FROM public.customers
    WHERE phone_number = p_phone AND deleted_at IS NULL;

    IF v_customer.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', '전화번호 또는 비밀번호가 일치하지 않습니다.');
    END IF;

    IF v_customer.password = extensions.crypt(p_password, v_customer.password) THEN
        RETURN jsonb_build_object('success', true, 'id', v_customer.id, 'nickname', v_customer.nickname, 'must_change_password', v_customer.must_change_password);
    ELSE
        RETURN jsonb_build_object('success', false, 'message', '전화번호 또는 비밀번호가 일치하지 않습니다.');
    END IF;
END;
$$;

-- [기능] 비밀번호 일치 여부 확인
CREATE OR REPLACE FUNCTION public.verify_password(customer_uuid uuid, input_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hashed_password text;
BEGIN
  SELECT password INTO v_hashed_password
  FROM public.customers
  WHERE id = customer_uuid
    AND deleted_at IS NULL;

  IF v_hashed_password IS NULL THEN
    RETURN false;
  END IF;

  RETURN v_hashed_password = extensions.crypt(input_password, v_hashed_password);
END;
$$;

-- [기능] 고객 비밀번호 변경 + 변경 이력 적재
CREATE OR REPLACE FUNCTION public.update_customer_password(
  customer_uuid uuid,
  new_password text,
  p_reason text DEFAULT 'user_change'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.validate_password_complexity(new_password) THEN
    RAISE EXCEPTION '비밀번호는 8자 이상, 영문 대/소문자, 숫자, 특수문자를 포함해야 합니다.';
  END IF;

  UPDATE public.customers
  SET password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      must_change_password = false
  WHERE id = customer_uuid
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.customer_password_audit_logs (customer_id, changed_by, reason, metadata)
  VALUES (customer_uuid, 'customer', p_reason, jsonb_build_object('source', 'update_customer_password'));

  RETURN true;
END;
$$;

-- 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.register_customer(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_customer(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_password(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_customer_password(uuid, text, text) TO anon, authenticated;

-- ==========================================
-- 6. 초기 데이터 삽입
-- ==========================================

-- 초기 관리자 설정 (배포 시크릿 주입)
-- app.settings.admin_id / app.settings.admin_password 에 값을 주입한 경우에만 생성
WITH injected_admin AS (
  SELECT
    NULLIF(current_setting('app.settings.admin_id', true), '') AS admin_id,
    NULLIF(current_setting('app.settings.admin_password', true), '') AS admin_password
)
INSERT INTO public.app_configs (key, value, description)
SELECT 'admin_id', admin_id, '관리자 로그인 아이디(배포 시크릿 주입)'
FROM injected_admin
WHERE admin_id IS NOT NULL
ON CONFLICT (key) DO NOTHING;

WITH injected_admin AS (
  SELECT NULLIF(current_setting('app.settings.admin_password', true), '') AS admin_password
)
INSERT INTO public.app_configs (key, value, description)
SELECT 'admin_password', extensions.crypt(admin_password, extensions.gen_salt('bf')), '관리자 인증용 비밀번호(배포 시크릿 해시 저장)'
FROM injected_admin
WHERE admin_password IS NOT NULL
ON CONFLICT (key) DO NOTHING;

-- ==========================================
-- AI Proxy 보안/제한 저장소
-- ==========================================

CREATE TABLE IF NOT EXISTS public.ai_proxy_rate_limits (
  id bigserial PRIMARY KEY,
  dimension text NOT NULL,
  identifier text NOT NULL,
  bucket_type text NOT NULL CHECK (bucket_type IN ('minute', 'hour')),
  bucket_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dimension, identifier, bucket_type, bucket_start)
);

CREATE TABLE IF NOT EXISTS public.ai_proxy_token_quotas (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  day_bucket date NOT NULL,
  month_bucket text NOT NULL,
  token_count bigint NOT NULL DEFAULT 0,
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_bucket, month_bucket)
);

ALTER TABLE public.ai_proxy_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_proxy_token_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role can manage ai_proxy_rate_limits"
ON public.ai_proxy_rate_limits
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "service role can manage ai_proxy_token_quotas"
ON public.ai_proxy_token_quotas
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.increment_ai_proxy_rate_limit(
  p_dimension text,
  p_identifier text,
  p_bucket_type text,
  p_bucket_start timestamptz,
  p_limit integer
)
RETURNS TABLE(allowed boolean, current_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.ai_proxy_rate_limits (dimension, identifier, bucket_type, bucket_start, request_count)
  VALUES (p_dimension, p_identifier, p_bucket_type, p_bucket_start, 1)
  ON CONFLICT (dimension, identifier, bucket_type, bucket_start)
  DO UPDATE
    SET request_count = public.ai_proxy_rate_limits.request_count + 1,
        updated_at = now()
  RETURNING request_count INTO v_count;

  RETURN QUERY SELECT (v_count <= p_limit), v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_ai_proxy_token_usage(
  p_user_id uuid,
  p_day_bucket date,
  p_month_bucket text,
  p_used_tokens bigint,
  p_daily_limit bigint,
  p_monthly_limit bigint
)
RETURNS TABLE(allowed boolean, daily_total bigint, monthly_total bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily_total bigint;
  v_monthly_total bigint;
BEGIN
  INSERT INTO public.ai_proxy_token_quotas (user_id, day_bucket, month_bucket, token_count, request_count)
  VALUES (p_user_id, p_day_bucket, p_month_bucket, p_used_tokens, 1)
  ON CONFLICT (user_id, day_bucket, month_bucket)
  DO UPDATE
    SET token_count = public.ai_proxy_token_quotas.token_count + EXCLUDED.token_count,
        request_count = public.ai_proxy_token_quotas.request_count + 1,
        updated_at = now();

  SELECT COALESCE(SUM(token_count), 0)
    INTO v_daily_total
  FROM public.ai_proxy_token_quotas
  WHERE user_id = p_user_id
    AND day_bucket = p_day_bucket;

  SELECT COALESCE(SUM(token_count), 0)
    INTO v_monthly_total
  FROM public.ai_proxy_token_quotas
  WHERE user_id = p_user_id
    AND month_bucket = p_month_bucket;

  RETURN QUERY SELECT (v_daily_total <= p_daily_limit AND v_monthly_total <= p_monthly_limit), v_daily_total, v_monthly_total;
END;
$$;
