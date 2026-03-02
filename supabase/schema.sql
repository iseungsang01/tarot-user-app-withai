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

-- 기본 권한 설정
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;

-- ==========================================
-- 2. 테이블 생성
-- ==========================================

-- [고객 테이블]
CREATE TABLE public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number varchar(13) NOT NULL,
    nickname varchar(20),
    password text NOT NULL DEFAULT crypt('1234', gen_salt('bf')),
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

-- ==========================================
-- 3. 인덱스 설정 (최적화)
-- ==========================================
CREATE INDEX idx_visit_history_customer ON visit_history(customer_id);
CREATE INDEX idx_coupon_history_customer ON coupon_history(customer_id);
CREATE INDEX idx_bug_reports_customer ON bug_reports(customer_id);
CREATE INDEX idx_vote_responses_customer ON vote_responses(customer_id);
CREATE INDEX idx_notices_pinned_published ON notices(is_pinned, is_published) WHERE is_published = true;

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

-- 공통 RLS 정책 (데모용으로 모두 허용되어 있으나 실제 운영 시 보안 강화 필요)
CREATE POLICY "Allow All Select" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow All Insert" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow All Update" ON customers FOR UPDATE USING (true);

CREATE POLICY "Allow All Select" ON visit_history FOR SELECT USING (true);
CREATE POLICY "Allow All Insert" ON visit_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow All Update" ON visit_history FOR UPDATE USING (true);
CREATE POLICY "Allow All Delete" ON visit_history FOR DELETE USING (true);

CREATE POLICY "Allow All Select" ON coupon_history FOR SELECT USING (true);
CREATE POLICY "Allow All Insert" ON coupon_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow All Update" ON coupon_history FOR UPDATE USING (true);
CREATE POLICY "Allow All Delete" ON coupon_history FOR DELETE USING (true);

CREATE POLICY "Allow All Select" ON notices FOR SELECT USING (true);
CREATE POLICY "Allow All Insert" ON notices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow All Update" ON notices FOR UPDATE USING (true);
CREATE POLICY "Allow All Delete" ON notices FOR DELETE USING (true);

CREATE POLICY "Allow All Select" ON bug_reports FOR SELECT USING (true);
CREATE POLICY "Allow All Insert" ON bug_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow All Update" ON bug_reports FOR UPDATE USING (true);
CREATE POLICY "Allow All Delete" ON bug_reports FOR DELETE USING (true);

CREATE POLICY "Allow All Select" ON votes FOR SELECT USING (true);
CREATE POLICY "Allow All Insert" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow All Update" ON votes FOR UPDATE USING (true);
CREATE POLICY "Allow All Delete" ON votes FOR DELETE USING (true);

CREATE POLICY "Allow All Select" ON vote_responses FOR SELECT USING (true);
CREATE POLICY "Allow All Insert" ON vote_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow All Update" ON vote_responses FOR UPDATE USING (true);
CREATE POLICY "Allow All Delete" ON vote_responses FOR DELETE USING (true);

CREATE POLICY "Allow Read Configs" ON app_configs FOR SELECT USING (true);

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

    v_nickname := COALESCE(NULLIF(p_nickname, ''), '유저_' || right(p_phone, 4));

    -- 데이터 삽입
    INSERT INTO public.customers (phone_number, password, nickname)
    VALUES (p_phone, extensions.crypt(p_password, extensions.gen_salt('bf')), v_nickname)
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
        RETURN jsonb_build_object('success', true, 'id', v_customer.id, 'nickname', v_customer.nickname);
    ELSE
        RETURN jsonb_build_object('success', false, 'message', '전화번호 또는 비밀번호가 일치하지 않습니다.');
    END IF;
END;
$$;

-- 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.register_customer(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_customer(text, text) TO anon, authenticated;

-- ==========================================
-- 6. 초기 데이터 삽입
-- ==========================================

-- 초기 관리자 설정 (로그인 시 필요)
-- 초기 아이디: admin, 초기 비밀번호: p1o2m3n4 (보안을 위해 첫 로그인 후 변경 권장)
INSERT INTO public.app_configs (key, value, description)
VALUES 
  ('admin_id', 'admin', '관리자 로그인 아이디'),
  ('admin_password', extensions.crypt('p1o2m3n4', extensions.gen_salt('bf')), '관리자 인증용 비밀번호 (해시저장)')
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
