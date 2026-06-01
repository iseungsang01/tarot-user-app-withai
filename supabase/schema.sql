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

-- [로그인 시도 추적]
CREATE TABLE public.login_attempt_tracker (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phone_hash text NOT NULL,
    ip_device_hash text NOT NULL,
    failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    lock_expires_at timestamptz,
    last_failed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE (phone_hash, ip_device_hash)
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

CREATE TABLE IF NOT EXISTS public.customer_sessions (
    token_hash text PRIMARY KEY,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    expires_at timestamptz NOT NULL DEFAULT (NOW() + interval '30 days'),
    revoked_at timestamptz
);

-- ==========================================
-- 3. 인덱스 설정 (최적화)
-- ==========================================
CREATE INDEX idx_visit_history_customer ON visit_history(customer_id);
CREATE INDEX idx_coupon_history_customer ON coupon_history(customer_id);
CREATE INDEX idx_bug_reports_customer ON bug_reports(customer_id);
CREATE INDEX idx_vote_responses_customer ON vote_responses(customer_id);
CREATE INDEX idx_notices_pinned_published ON notices(is_pinned, is_published) WHERE is_published = true;
CREATE INDEX idx_login_attempt_tracker_phone_hash ON login_attempt_tracker(phone_hash);
CREATE INDEX idx_login_attempt_tracker_lock_expires_at ON login_attempt_tracker(lock_expires_at);
CREATE INDEX idx_customer_password_audit_customer ON customer_password_audit_logs(customer_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON public.customer_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_active ON public.customer_sessions(customer_id, expires_at) WHERE revoked_at IS NULL;

-- Additional query optimization indexes
CREATE INDEX idx_visit_history_visit_date ON visit_history(visit_date);
CREATE INDEX idx_vote_responses_vote_id ON vote_responses(vote_id);
CREATE INDEX idx_visit_history_not_deleted ON visit_history(customer_id) WHERE is_deleted = false;

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
ALTER TABLE login_attempt_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

-- 공통 RLS 정책 (데모용으로 모두 허용되어 있으나 실제 운영 시 보안 강화 필요)
CREATE POLICY "Allow All Select" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow All Insert" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow All Update" ON customers FOR UPDATE USING (true);

CREATE POLICY "Allow All Select" ON visit_history FOR SELECT USING (true);
CREATE POLICY "Allow All Insert" ON visit_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow All Update" ON visit_history FOR UPDATE USING (true);
CREATE POLICY "Allow All Delete" ON visit_history FOR DELETE USING (true);

CREATE POLICY "Allow All Select" ON coupon_history FOR SELECT USING (true);

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
ALTER TABLE customer_password_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No Direct Access customer_sessions" ON public.customer_sessions
FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

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
CREATE POLICY "No Direct Mutation coupon_history" ON coupon_history
FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

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
    char_length(p_password) >= 6
  );
END;
$$;

CREATE POLICY "No Direct Access login_attempt_tracker" ON login_attempt_tracker
FOR ALL
USING (false)
WITH CHECK (false);

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
    p_id uuid,
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
        RETURN jsonb_build_object('success', false, 'message', '비밀번호는 6자 이상이어야 합니다.');
    END IF;

    v_nickname := COALESCE(NULLIF(p_nickname, ''), '유저_' || right(p_phone, 4));

    -- 데이터 삽입
    INSERT INTO public.customers (id, phone_number, password, nickname)
    VALUES (p_id, p_phone, extensions.crypt(p_password, extensions.gen_salt('bf')), v_nickname)
    RETURNING id INTO v_customer_id;

    RETURN jsonb_build_object('success', true, 'id', v_customer_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', '회원가입 에러: ' || SQLERRM);
END;
$$;

-- [기능] 고객 로그인
CREATE OR REPLACE FUNCTION public.login_customer(
    p_phone text,
    p_password text,
    p_client_fingerprint text DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_customer public.customers%ROWTYPE;
    v_phone_hash text;
    v_device_hash text;
    v_phone_lock_expires_at timestamptz;
    v_device_lock_expires_at timestamptz;
    v_lock_expires_at timestamptz;
    v_max_failed_attempts integer := 5;
    v_lock_minutes integer := 5;
    v_session_token text;
BEGIN
    v_phone_hash := encode(extensions.digest(p_phone, 'sha256'), 'hex');
    v_device_hash := encode(extensions.digest(COALESCE(NULLIF(trim(p_client_fingerprint), ''), 'unknown'), 'sha256'), 'hex');

    SELECT lock_expires_at
    INTO v_phone_lock_expires_at
    FROM public.login_attempt_tracker
    WHERE phone_hash = v_phone_hash
      AND ip_device_hash = '__phone__';

    SELECT lock_expires_at
    INTO v_device_lock_expires_at
    FROM public.login_attempt_tracker
    WHERE phone_hash = v_phone_hash
      AND ip_device_hash = v_device_hash;

    v_lock_expires_at := GREATEST(
        COALESCE(v_phone_lock_expires_at, '-infinity'::timestamptz),
        COALESCE(v_device_lock_expires_at, '-infinity'::timestamptz)
    );

    IF v_lock_expires_at > NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'locked', true,
            'lock_expires_at', v_lock_expires_at,
            'message', '로그인 시도가 많아 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.'
        );
    END IF;

    SELECT * INTO v_customer
    FROM public.customers
    WHERE phone_number = p_phone AND deleted_at IS NULL;

    IF v_customer.id IS NULL OR v_customer.password != extensions.crypt(p_password, v_customer.password) THEN
        INSERT INTO public.login_attempt_tracker (phone_hash, ip_device_hash, failed_attempts, lock_expires_at, last_failed_at, updated_at)
        VALUES (
            v_phone_hash,
            '__phone__',
            1,
            NULL,
            NOW(),
            NOW()
        )
        ON CONFLICT (phone_hash, ip_device_hash)
        DO UPDATE SET
            failed_attempts = CASE
                WHEN COALESCE(public.login_attempt_tracker.lock_expires_at, '-infinity'::timestamptz) > NOW() THEN public.login_attempt_tracker.failed_attempts
                ELSE public.login_attempt_tracker.failed_attempts + 1
            END,
            lock_expires_at = CASE
                WHEN COALESCE(public.login_attempt_tracker.lock_expires_at, '-infinity'::timestamptz) > NOW() THEN public.login_attempt_tracker.lock_expires_at
                WHEN public.login_attempt_tracker.failed_attempts + 1 >= v_max_failed_attempts THEN NOW() + make_interval(mins => v_lock_minutes)
                ELSE NULL
            END,
            last_failed_at = NOW(),
            updated_at = NOW();

        INSERT INTO public.login_attempt_tracker (phone_hash, ip_device_hash, failed_attempts, lock_expires_at, last_failed_at, updated_at)
        VALUES (
            v_phone_hash,
            v_device_hash,
            1,
            NULL,
            NOW(),
            NOW()
        )
        ON CONFLICT (phone_hash, ip_device_hash)
        DO UPDATE SET
            failed_attempts = CASE
                WHEN COALESCE(public.login_attempt_tracker.lock_expires_at, '-infinity'::timestamptz) > NOW() THEN public.login_attempt_tracker.failed_attempts
                ELSE public.login_attempt_tracker.failed_attempts + 1
            END,
            lock_expires_at = CASE
                WHEN COALESCE(public.login_attempt_tracker.lock_expires_at, '-infinity'::timestamptz) > NOW() THEN public.login_attempt_tracker.lock_expires_at
                WHEN public.login_attempt_tracker.failed_attempts + 1 >= v_max_failed_attempts THEN NOW() + make_interval(mins => v_lock_minutes)
                ELSE NULL
            END,
            last_failed_at = NOW(),
            updated_at = NOW();

        RETURN jsonb_build_object('success', false, 'message', '전화번호 또는 비밀번호가 일치하지 않습니다.');
    END IF;

    DELETE FROM public.login_attempt_tracker
    WHERE phone_hash = v_phone_hash
      AND ip_device_hash IN ('__phone__', v_device_hash);

    v_session_token := encode(extensions.gen_random_bytes(32), 'hex');
    INSERT INTO public.customer_sessions (token_hash, customer_id)
    VALUES (encode(extensions.digest(v_session_token, 'sha256'), 'hex'), v_customer.id);

    RETURN jsonb_build_object(
        'success', true,
        'session_token', v_session_token,
        'id', v_customer.id,
        'nickname', v_customer.nickname,
        'phone_number', v_customer.phone_number,
        'current_stamps', v_customer.current_stamps,
        'visit_count', v_customer.visit_count,
        'must_change_password', v_customer.must_change_password
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_customer_session(p_session_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  IF p_session_token IS NULL OR btrim(p_session_token) = '' THEN
    RAISE EXCEPTION 'customer session is required' USING ERRCODE = '28000';
  END IF;

  SELECT s.customer_id
  INTO v_customer_id
  FROM public.customer_sessions s
  JOIN public.customers c ON c.id = s.customer_id
  WHERE s.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND c.deleted_at IS NULL;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer session is invalid or expired' USING ERRCODE = '28000';
  END IF;

  RETURN v_customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.logout_customer(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customer_sessions
  SET revoked_at = now()
  WHERE token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile(p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_customer public.customers%ROWTYPE;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);

  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = v_customer_id
    AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'nickname', v_customer.nickname,
      'phone_number', v_customer.phone_number,
      'current_stamps', v_customer.current_stamps,
      'visit_count', v_customer.visit_count,
      'must_change_password', v_customer.must_change_password
    )
  );
END;
$$;

-- [function] Customer coupon lookup

CREATE OR REPLACE FUNCTION public.get_my_coupons(
  p_session_token text,
  p_valid_only boolean DEFAULT false
)
RETURNS SETOF public.coupon_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);

  RETURN QUERY
  SELECT *
  FROM public.coupon_history ch
  WHERE ch.customer_id = v_customer_id
    AND ch.is_used = false
    AND (
      NOT COALESCE(p_valid_only, false)
      OR ch.valid_until IS NULL
      OR ch.valid_until >= now()
    )
  ORDER BY ch.issued_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_coupon_count(
  p_session_token text,
  p_valid_only boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_count integer;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);

  SELECT count(*)::integer
  INTO v_count
  FROM public.coupon_history ch
  WHERE ch.customer_id = v_customer_id
    AND ch.is_used = false
    AND (
      NOT COALESCE(p_valid_only, false)
      OR ch.valid_until IS NULL
      OR ch.valid_until >= now()
    );

  RETURN COALESCE(v_count, 0);
END;
$$;

-- [function] Customer password verification
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
    RAISE EXCEPTION '비밀번호는 6자 이상이어야 합니다.';
  END IF;

  UPDATE public.customers
  SET password = extensions.crypt(new_password, extensions.gen_salt('bf'))
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
GRANT EXECUTE ON FUNCTION public.register_customer(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_customer(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_customer_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.logout_customer(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_coupons(text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_coupon_count(text, boolean) TO anon, authenticated;
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
-- AI monthly usage tracking
-- ==========================================

CREATE TABLE IF NOT EXISTS public.ai_monthly_usage (
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  month_bucket date NOT NULL,
  usage_type text NOT NULL CHECK (usage_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, month_bucket, usage_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_monthly_usage_customer_month
  ON public.ai_monthly_usage(customer_id, month_bucket);

ALTER TABLE public.ai_monthly_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No Direct Access ai_monthly_usage" ON public.ai_monthly_usage;
CREATE POLICY "No Direct Access ai_monthly_usage"
ON public.ai_monthly_usage
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE ON public.ai_monthly_usage TO service_role;
REVOKE ALL ON public.ai_monthly_usage FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_ai_monthly_usage(
  p_session_token text,
  p_month_bucket date DEFAULT date_trunc('month', now())::date
)
RETURNS TABLE(
  usage_type text,
  usage_count integer,
  month_bucket date,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);

  RETURN QUERY
  SELECT u.usage_type, u.usage_count, u.month_bucket, u.updated_at
  FROM public.ai_monthly_usage u
  WHERE u.customer_id = v_customer_id
    AND u.month_bucket = COALESCE(p_month_bucket, date_trunc('month', now())::date)
  ORDER BY u.usage_type;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_my_ai_monthly_usage(
  p_session_token text,
  p_usage_type text,
  p_month_bucket date DEFAULT date_trunc('month', now())::date,
  p_increment integer DEFAULT 1
)
RETURNS TABLE(
  usage_type text,
  usage_count integer,
  month_bucket date,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_month_bucket date;
  v_increment integer;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  v_month_bucket := COALESCE(p_month_bucket, date_trunc('month', now())::date);
  v_increment := COALESCE(p_increment, 1);

  IF p_usage_type IS NULL OR p_usage_type !~ '^[a-z][a-z0-9_]{1,63}$' THEN
    RAISE EXCEPTION 'invalid ai usage type';
  END IF;

  IF v_increment < 1 THEN
    RAISE EXCEPTION 'increment must be positive';
  END IF;

  RETURN QUERY
  INSERT INTO public.ai_monthly_usage (customer_id, month_bucket, usage_type, usage_count)
  VALUES (v_customer_id, v_month_bucket, p_usage_type, v_increment)
  ON CONFLICT ON CONSTRAINT ai_monthly_usage_pkey
  DO UPDATE SET
    usage_count = public.ai_monthly_usage.usage_count + EXCLUDED.usage_count,
    updated_at = now()
  RETURNING public.ai_monthly_usage.usage_type,
            public.ai_monthly_usage.usage_count,
            public.ai_monthly_usage.month_bucket,
            public.ai_monthly_usage.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_ai_monthly_usage(text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_my_ai_monthly_usage(text, text, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_ai_monthly_usage(text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_my_ai_monthly_usage(text, text, date, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.use_my_coupon_with_admin_password(
  p_session_token text,
  p_coupon_id integer,
  p_admin_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_hashed_password text;
  v_coupon public.coupon_history%ROWTYPE;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);

  IF p_admin_password IS NULL OR btrim(p_admin_password) = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'INVALID_ADMIN_PASSWORD', 'message', '??? ????? ??????.');
  END IF;

  SELECT value INTO v_hashed_password
  FROM public.app_configs
  WHERE key = 'admin_password';

  IF v_hashed_password IS NULL OR v_hashed_password <> extensions.crypt(p_admin_password, v_hashed_password) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'INVALID_ADMIN_PASSWORD', 'message', '??? ????? ???? ????.');
  END IF;

  UPDATE public.coupon_history
  SET is_used = true,
      used_at = now()
  WHERE id = p_coupon_id
    AND customer_id = v_customer_id
    AND is_used = false
    AND (valid_until IS NULL OR valid_until >= now())
  RETURNING * INTO v_coupon;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'COUPON_NOT_AVAILABLE', 'message', '?? ??? ??? ?? ? ????.');
  END IF;

  RETURN jsonb_build_object('success', true, 'coupon', to_jsonb(v_coupon));
END;
$$;

REVOKE ALL ON FUNCTION public.use_my_coupon_with_admin_password(text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.use_my_coupon_with_admin_password(text, integer, text) TO anon, authenticated;
