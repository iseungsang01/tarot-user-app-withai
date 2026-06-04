-- Squashed baseline migration generated from supabase/schema.sql.
-- Applies the complete integrated app schema on a fresh Supabase local database.

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
  is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.visit_history
  ADD COLUMN IF NOT EXISTS stamp_count integer NOT NULL DEFAULT 1 CHECK (stamp_count > 0);

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
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.customers,
  public.visit_history,
  public.coupon_history,
  public.notices,
  public.bug_reports,
  public.votes,
  public.vote_responses
TO authenticated;

GRANT SELECT ON TABLE public.notices, public.votes TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

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
DROP FUNCTION IF EXISTS public.verify_admin_password(text);
DROP FUNCTION IF EXISTS public.verify_admin_login(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_admin_settings(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.increment_visit_count(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.use_my_coupon(text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.use_my_coupon_with_admin_password(text, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.register_customer(uuid, text, text, text) CASCADE;


CREATE OR REPLACE FUNCTION public.validate_password_complexity(p_password text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$ SELECT p_password IS NOT NULL AND char_length(p_password) >= 6 $$;

CREATE OR REPLACE FUNCTION public.resolve_customer_session(p_session_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_customer_id uuid; v_token_hash text;
BEGIN
  IF p_session_token IS NULL OR length(trim(p_session_token)) = 0 THEN RETURN NULL; END IF;
  v_token_hash := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

  SELECT s.customer_id INTO v_customer_id
  FROM public.customer_sessions s
  JOIN public.customers c ON c.id = s.customer_id
  WHERE s.token_hash = v_token_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND c.deleted_at IS NULL;

  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customer_sessions SET last_used_at = now() WHERE token_hash = v_token_hash;
  END IF;

  RETURN v_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_customer_session(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.issue_ai_guest_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session_token text;
  v_expires_at timestamptz := now() + interval '1 day';
BEGIN
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

CREATE OR REPLACE FUNCTION public.register_customer(p_phone text, p_password text, p_nickname text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_customer_id uuid; v_nickname text;
BEGIN
  IF p_phone !~ '^\d{3}-\d{3,4}-\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid phone format. Use 010-1234-5678.');
  END IF;
  IF NOT public.validate_password_complexity(p_password) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Password must be at least 6 characters.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.customers WHERE phone_number = p_phone AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Phone number already registered.');
  END IF;

  v_nickname := COALESCE(NULLIF(p_nickname, ''), 'user_' || right(p_phone, 4));
  INSERT INTO public.customers (phone_number, password, nickname)
  VALUES (p_phone, extensions.crypt(p_password, extensions.gen_salt('bf')), v_nickname)
  RETURNING id INTO v_customer_id;

  RETURN jsonb_build_object('success', true, 'id', v_customer_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.login_customer(p_phone text, p_password text, p_client_fingerprint text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_phone_hash text := encode(extensions.digest(p_phone, 'sha256'), 'hex');
  v_device_hash text := encode(extensions.digest(COALESCE(NULLIF(trim(p_client_fingerprint), ''), 'unknown'), 'sha256'), 'hex');
  v_lock_expires_at timestamptz;
  v_session_token text;
BEGIN
  SELECT max(lock_expires_at) INTO v_lock_expires_at
  FROM public.login_attempt_tracker
  WHERE phone_hash = v_phone_hash AND ip_device_hash IN ('__phone__', v_device_hash);

  IF COALESCE(v_lock_expires_at, '-infinity'::timestamptz) > now() THEN
    RETURN jsonb_build_object('success', false, 'locked', true, 'lock_expires_at', v_lock_expires_at, 'message', 'Too many login attempts.');
  END IF;

  SELECT * INTO v_customer FROM public.customers WHERE phone_number = p_phone AND deleted_at IS NULL;

  IF v_customer.id IS NULL OR v_customer.password != extensions.crypt(p_password, v_customer.password) THEN
    INSERT INTO public.login_attempt_tracker (phone_hash, ip_device_hash, failed_attempts, lock_expires_at, last_failed_at, updated_at)
    VALUES (v_phone_hash, '__phone__', 1, NULL, now(), now()), (v_phone_hash, v_device_hash, 1, NULL, now(), now())
    ON CONFLICT (phone_hash, ip_device_hash) DO UPDATE SET
      failed_attempts = public.login_attempt_tracker.failed_attempts + 1,
      lock_expires_at = CASE WHEN public.login_attempt_tracker.failed_attempts + 1 >= 5 THEN now() + interval '5 minutes' ELSE NULL END,
      last_failed_at = now(),
      updated_at = now();

    RETURN jsonb_build_object('success', false, 'reason', 'INVALID_PASSWORD', 'message', 'Invalid phone or password.');
  END IF;

  DELETE FROM public.login_attempt_tracker WHERE phone_hash = v_phone_hash AND ip_device_hash IN ('__phone__', v_device_hash);

  v_session_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.customer_sessions (customer_id, token_hash, expires_at, last_used_at)
  VALUES (v_customer.id, encode(extensions.digest(v_session_token, 'sha256'), 'hex'), now() + interval '30 days', now());

  RETURN jsonb_build_object('success', true, 'session_token', v_session_token, 'expires_at', now() + interval '30 days', 'customer', to_jsonb(v_customer) - 'password');
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
  v_customer_id := public.resolve_customer_session(p_session_token);
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
    AND vh.is_deleted = false;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_visits(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_visit(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_visits(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_visit(text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_my_nickname(p_id uuid, p_new_nickname text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.customers SET nickname = p_new_nickname WHERE id = p_id AND deleted_at IS NULL;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_account(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.customers
  SET deleted_at = now(), phone_number = phone_number || '_deleted_' || substring(md5(random()::text) from 1 for 5)
  WHERE id = p_id AND deleted_at IS NULL;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_customer(customer_uuid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.delete_my_account(customer_uuid)
$$;

CREATE OR REPLACE FUNCTION public.verify_password(customer_uuid uuid, input_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_hashed_password text;
BEGIN
  SELECT password INTO v_hashed_password FROM public.customers WHERE id = customer_uuid AND deleted_at IS NULL;
  RETURN v_hashed_password IS NOT NULL AND v_hashed_password = extensions.crypt(input_password, v_hashed_password);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_customer_password(customer_uuid uuid, new_password text, p_reason text DEFAULT 'user_change')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.validate_password_complexity(new_password) THEN RAISE EXCEPTION 'Password must be at least 6 characters.'; END IF;

  UPDATE public.customers
  SET password = extensions.crypt(new_password, extensions.gen_salt('bf')), must_change_password = false
  WHERE id = customer_uuid AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.customer_password_audit_logs (customer_id, changed_by, reason, metadata)
  VALUES (customer_uuid, 'customer', p_reason, jsonb_build_object('source', 'update_customer_password'));
  RETURN true;
END;
$$;

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


CREATE OR REPLACE FUNCTION public.redeem_coupon(
  p_coupon_id integer,
  p_admin_password text,
  p_session_token text
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_config_hash text;
  v_legacy_password text;
  v_coupon public.coupon_history%ROWTYPE;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RETURN QUERY SELECT false, 'invalid_session'::text;
    RETURN;
  END IF;

  IF p_admin_password IS NULL OR btrim(p_admin_password) = '' THEN
    RETURN QUERY SELECT false, 'invalid_admin_password'::text;
    RETURN;
  END IF;

  v_config_hash := current_setting('app.admin_password_hash', true);
  v_legacy_password := current_setting('app.admin_password', true);

  IF NOT (
    (v_config_hash IS NOT NULL AND v_config_hash = extensions.crypt(p_admin_password, v_config_hash))
    OR (v_legacy_password IS NOT NULL AND v_legacy_password = p_admin_password)
  ) THEN
    RETURN QUERY SELECT false, 'invalid_admin_password'::text;
    RETURN;
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupon_history
  WHERE id = p_coupon_id
    AND customer_id = v_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'coupon_not_found'::text;
    RETURN;
  END IF;

  IF v_coupon.is_used THEN
    RETURN QUERY SELECT false, 'coupon_already_used'::text;
    RETURN;
  END IF;

  UPDATE public.coupon_history
  SET is_used = true,
      used_at = now()
  WHERE id = v_coupon.id;

  RETURN QUERY SELECT true, 'ok'::text;
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

CREATE OR REPLACE FUNCTION public.submit_vote_response(p_session_token text, p_vote_id integer, p_selected_options integer[], p_response_id integer DEFAULT NULL)
RETURNS public.vote_responses LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_customer_id uuid; v_vote public.votes%ROWTYPE; v_response public.vote_responses%ROWTYPE; v_count integer;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_vote FROM public.votes WHERE id = p_vote_id AND is_active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now());
  IF v_vote.id IS NULL THEN RAISE EXCEPTION 'Vote is not active' USING ERRCODE = '22023'; END IF;
  v_count := COALESCE(array_length(p_selected_options, 1), 0);
  IF v_count = 0 OR (NOT v_vote.allow_multiple AND v_count > 1) OR v_count > v_vote.max_selections THEN RAISE EXCEPTION 'Invalid vote selection' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_selected_options) x WHERE x < 0) THEN RAISE EXCEPTION 'Invalid selected option' USING ERRCODE = '22023'; END IF;

  IF p_response_id IS NOT NULL THEN
    UPDATE public.vote_responses SET selected_options = p_selected_options, voted_at = now()
    WHERE id = p_response_id AND vote_id = p_vote_id AND customer_id = v_customer_id RETURNING * INTO v_response;
  ELSE
    INSERT INTO public.vote_responses (vote_id, customer_id, selected_options)
    VALUES (p_vote_id, v_customer_id, p_selected_options)
    ON CONFLICT (vote_id, customer_id) DO UPDATE SET selected_options = EXCLUDED.selected_options, voted_at = now()
    RETURNING * INTO v_response;
  END IF;
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_vote_response(p_session_token text, p_vote_id integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000'; END IF;
  DELETE FROM public.vote_responses WHERE vote_id = p_vote_id AND customer_id = v_customer_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vote_summary(p_vote_id integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'results', COALESCE((
      SELECT jsonb_object_agg(option_id::text, option_count)
      FROM (SELECT selected_option option_id, count(*) option_count FROM public.vote_responses vr CROSS JOIN LATERAL unnest(vr.selected_options) selected_option WHERE vr.vote_id = p_vote_id GROUP BY selected_option) x
    ), '{}'::jsonb),
    'count', (SELECT count(*) FROM public.vote_responses WHERE vote_id = p_vote_id)
  )
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

CREATE OR REPLACE FUNCTION public.submit_bug_report(p_session_token text, p_title text, p_description text, p_report_type text DEFAULT 'app_bug', p_screenshot text DEFAULT NULL, p_device_info jsonb DEFAULT NULL)
RETURNS public.bug_reports LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_customer_id uuid; v_report public.bug_reports%ROWTYPE;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000'; END IF;
  IF length(trim(coalesce(p_title, ''))) = 0 OR length(trim(coalesce(p_description, ''))) = 0 THEN RAISE EXCEPTION 'Report title and description are required' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.bug_reports (customer_id, title, description, report_type, screenshot, device_info)
  VALUES (v_customer_id, left(trim(p_title), 100), trim(p_description), coalesce(nullif(trim(p_report_type), ''), 'app_bug'), nullif(trim(coalesce(p_screenshot, '')), ''), coalesce(p_device_info, '{}'::jsonb))
  RETURNING * INTO v_report;
  RETURN v_report;
END;
$$;


GRANT EXECUTE ON FUNCTION public.register_customer(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_customer(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_ai_guest_session() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_ai_proxy_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.logout_ai_guest_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.logout_customer(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_stats(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_nickname(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_customer(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_password(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_customer_password(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_coupons(text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_coupon_count(text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_vote_responses(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_vote_response(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_vote_response(text, integer, integer[], integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_vote_response(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vote_summary(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_bug_reports(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_bug_report(text, text, text, text, text, jsonb) TO anon, authenticated;


