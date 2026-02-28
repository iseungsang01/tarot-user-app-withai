-- ==========================================
-- Tarot Drawer - Supabase Schema (업데이트 버전)
-- 요구사항 반영:
-- 1) 멤버십/AI 사용량 로직 제거
-- 2) bug_reports 는 앱 버그 접수 전용
-- 3) notices 상세용 이미지 컬럼 추가
-- 4) bug_reports 스크린샷 컬럼 추가
-- ==========================================

-- ==========================================
-- 1. 초기화 및 확장 모듈
-- ==========================================
DROP VIEW IF EXISTS customer_details;
DROP TABLE IF EXISTS vote_responses, votes, bug_reports, notices, coupon_history, visit_history, customers, app_configs CASCADE;

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

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

    -- 멤버십/AI 사용량 관련 컬럼 제거
    visit_count integer DEFAULT 0 CHECK (visit_count >= 0),
    last_visit timestamptz DEFAULT NOW(),
    created_at timestamptz DEFAULT NOW(),
    deleted_at timestamptz,

    CONSTRAINT chk_phone_format CHECK (phone_number ~ '^\d{3}-\d{3,4}-\d{4}$')
);

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

-- [버그 리포트] - 앱 버그 전용
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

-- ==========================================
-- 3. 인덱스 설정
-- ==========================================
CREATE INDEX idx_visit_history_customer ON visit_history(customer_id);
CREATE INDEX idx_coupon_history_customer ON coupon_history(customer_id);
CREATE INDEX idx_bug_reports_customer ON bug_reports(customer_id);
CREATE INDEX idx_vote_responses_customer ON vote_responses(customer_id);
CREATE INDEX idx_notices_pinned_published ON notices(is_pinned, is_published) WHERE is_published = true;

-- ==========================================
-- 4. RLS 활성화
-- ==========================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_responses ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 5. RLS 정책
-- ==========================================
CREATE POLICY "Customers SELECT" ON customers FOR SELECT USING (true);
CREATE POLICY "Customers INSERT" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Customers UPDATE" ON customers FOR UPDATE USING (true);

CREATE POLICY "Visit History SELECT" ON visit_history FOR SELECT USING (true);
CREATE POLICY "Visit History INSERT" ON visit_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Visit History UPDATE" ON visit_history FOR UPDATE USING (true);
CREATE POLICY "Visit History DELETE" ON visit_history FOR DELETE USING (true);

CREATE POLICY "Coupon History SELECT" ON coupon_history FOR SELECT USING (true);
CREATE POLICY "Coupon History INSERT" ON coupon_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Coupon History UPDATE" ON coupon_history FOR UPDATE USING (true);
CREATE POLICY "Coupon History DELETE" ON coupon_history FOR DELETE USING (true);

CREATE POLICY "Notices SELECT" ON notices FOR SELECT USING (true);
CREATE POLICY "Notices INSERT" ON notices FOR INSERT WITH CHECK (true);
CREATE POLICY "Notices UPDATE" ON notices FOR UPDATE USING (true);
CREATE POLICY "Notices DELETE" ON notices FOR DELETE USING (true);

CREATE POLICY "Bug Reports SELECT" ON bug_reports FOR SELECT USING (true);
CREATE POLICY "Bug Reports INSERT" ON bug_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Bug Reports UPDATE" ON bug_reports FOR UPDATE USING (true);
CREATE POLICY "Bug Reports DELETE" ON bug_reports FOR DELETE USING (true);

CREATE POLICY "Votes SELECT" ON votes FOR SELECT USING (true);
CREATE POLICY "Votes INSERT" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Votes UPDATE" ON votes FOR UPDATE USING (true);
CREATE POLICY "Votes DELETE" ON votes FOR DELETE USING (true);

CREATE POLICY "Vote Responses SELECT" ON vote_responses FOR SELECT USING (true);
CREATE POLICY "Vote Responses INSERT" ON vote_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Vote Responses UPDATE" ON vote_responses FOR UPDATE USING (true);
CREATE POLICY "Vote Responses DELETE" ON vote_responses FOR DELETE USING (true);

-- ==========================================
-- 6. RPC 함수
-- ==========================================

CREATE OR REPLACE FUNCTION update_my_nickname(
    p_id uuid,
    p_new_nickname text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE customers SET nickname = p_new_nickname WHERE id = p_id;
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION delete_my_account(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE customers
    SET deleted_at = NOW(),
        phone_number = phone_number || '_deleted_' || substring(md5(random()::text) from 1 for 5)
    WHERE id = p_id;
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION increment_visit_count(target_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE customers
  SET
    visit_count = COALESCE(visit_count, 0) + 1,
    last_visit = NOW()
  WHERE id = target_customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION verify_admin_password(p_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_hashed_password TEXT;
BEGIN
  SELECT value INTO v_hashed_password FROM app_configs WHERE key = 'admin_password';
  RETURN v_hashed_password = crypt(p_password, v_hashed_password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION verify_admin_login(p_id TEXT, p_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_stored_id TEXT;
  v_hashed_password TEXT;
BEGIN
  SELECT value INTO v_stored_id FROM app_configs WHERE key = 'admin_id';
  SELECT value INTO v_hashed_password FROM app_configs WHERE key = 'admin_password';

  RETURN (v_stored_id = p_id) AND (v_hashed_password = crypt(p_password, v_hashed_password));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_admin_settings(p_current_password TEXT, p_new_id TEXT, p_new_password TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_hashed_password TEXT;
BEGIN
  SELECT value INTO v_hashed_password FROM app_configs WHERE key = 'admin_password';

  IF v_hashed_password = crypt(p_current_password, v_hashed_password) THEN
    IF p_new_id IS NOT NULL AND p_new_id <> '' THEN
      UPDATE app_configs SET value = p_new_id, updated_at = NOW() WHERE key = 'admin_id';
    END IF;

    IF p_new_password IS NOT NULL AND p_new_password <> '' THEN
      UPDATE app_configs SET value = crypt(p_new_password, gen_salt('bf')), updated_at = NOW() WHERE key = 'admin_password';
    END IF;

    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS register_customer(text, text, text);
CREATE OR REPLACE FUNCTION register_customer(
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
    IF p_phone !~ '^\d{3}-\d{3,4}-\d{4}$' THEN
        RETURN jsonb_build_object('success', false, 'message', '전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)');
    END IF;

    IF EXISTS (SELECT 1 FROM public.customers WHERE phone_number = p_phone AND deleted_at IS NULL) THEN
        RETURN jsonb_build_object('success', false, 'message', '이미 가입된 전화번호입니다.');
    END IF;

    v_nickname := COALESCE(NULLIF(p_nickname, ''), '유저_' || right(p_phone, 4));

    INSERT INTO public.customers (phone_number, password, nickname)
    VALUES (p_phone, extensions.crypt(p_password, extensions.gen_salt('bf')), v_nickname)
    RETURNING id INTO v_customer_id;

    RETURN jsonb_build_object('success', true, 'id', v_customer_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', '회원가입 에러: ' || SQLERRM);
END;
$$;

DROP FUNCTION IF EXISTS login_customer(text, text);
CREATE OR REPLACE FUNCTION login_customer(
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

GRANT EXECUTE ON FUNCTION public.register_customer(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_customer(text, text) TO anon, authenticated;

-- ==========================================
-- 7. 환경 설정 및 초기 데이터
-- ==========================================

CREATE TABLE IF NOT EXISTS app_configs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE app_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow Read Configs" ON app_configs FOR SELECT USING (true);

INSERT INTO app_configs (key, value, description)
VALUES
  ('admin_id', 'admin', '관리자 로그인 아이디'),
  ('admin_password', crypt('p1o2m3n4', gen_salt('bf')), '관리자 인증용 비밀번호 (해시저장)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 멤버십/AI 사용량 함수 제거
DROP FUNCTION IF EXISTS public.increment_ai_usage(uuid);
