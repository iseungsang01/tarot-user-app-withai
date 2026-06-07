-- SHARED DATABASE SAFETY WARNING
-- This manager schema is not a shared-production cleanup script.
-- Do not apply destructive DROP FUNCTION cleanup to a DB that is also used by the user app.
-- User-app RPCs such as resolve_customer_session, login_customer, AI quota, coupons, votes, and bug reports must remain installed.

-- Tarot Manager App - Supabase schema
-- Scope: the current manager app in src/ only.
-- Required SQL functions kept:
--   1) public.is_admin()         - RLS helper for admin JWTs issued by supabase/functions/admin-login
--   2) public.register_customer  - hashes the initial customer password before manager-created insert
-- Removed from this schema: legacy customer-session/auth RPCs, AI quota RPCs, and browser-admin-password RPCs.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA extensions TO authenticated;

-- -----------------------------------------------------------------------------
-- Function cleanup: functions not called by this manager app.
-- These drops are intentionally limited to RPC/function objects and do not delete data.
-- -----------------------------------------------------------------------------
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.validate_password_complexity(text);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.resolve_customer_session(text);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.login_customer(text, text, text);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.get_my_profile(text);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.logout_customer(text);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.get_customer_stats(text);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.update_my_nickname(uuid, text);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.delete_my_account(uuid);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.soft_delete_customer(uuid);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.verify_password(uuid, text);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.update_customer_password(uuid, text, text);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.get_my_coupons(text, boolean);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.get_my_coupon_count(text, boolean);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.use_my_coupon(text, integer);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.get_my_vote_responses(text);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.get_my_vote_response(text, integer);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.submit_vote_response(text, integer, integer[], integer);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.cancel_vote_response(text, integer);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.get_vote_summary(integer);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.get_my_bug_reports(text);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.submit_bug_report(text, text, text, text, text, jsonb);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.get_my_ai_monthly_usage(text, date);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.increment_my_ai_monthly_usage(text, text, date, integer);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.verify_admin_password(text);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.verify_admin_login(text, text);
-- SHARED DB DANGER: disabled manager-only cleanup: DROP FUNCTION IF EXISTS public.update_admin_settings(text, text, text);

-- -----------------------------------------------------------------------------
-- Tables used by src/components/*.js
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  phone_number varchar(13) NOT NULL,
  nickname varchar(20),
  password text NOT NULL DEFAULT '',
  must_change_password boolean NOT NULL DEFAULT false,
  birthday date,
  current_stamps integer NOT NULL DEFAULT 0 CHECK (current_stamps >= 0 AND current_stamps <= 10),
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
CREATE INDEX IF NOT EXISTS idx_customers_last_visit_active
  ON public.customers(last_visit DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_birthday_active
  ON public.customers(birthday)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.visit_history (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  visit_date timestamptz NOT NULL DEFAULT now(),
  stamp_count integer NOT NULL DEFAULT 1 CHECK (stamp_count > 0),
  is_deleted boolean NOT NULL DEFAULT false
);

-- Existing databases may have been created before stamp_count was added.
ALTER TABLE public.visit_history
  ADD COLUMN IF NOT EXISTS stamp_count integer NOT NULL DEFAULT 1 CHECK (stamp_count > 0);

CREATE INDEX IF NOT EXISTS idx_visit_history_customer
  ON public.visit_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_visit_history_visit_date
  ON public.visit_history(visit_date DESC);

CREATE TABLE IF NOT EXISTS public.coupon_history (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  coupon_code varchar(50) NOT NULL UNIQUE,
  valid_until timestamptz,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  CONSTRAINT chk_coupon_history_status CHECK (
    (is_used = false AND used_at IS NULL)
    OR
    (is_used = true AND used_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_coupon_history_customer
  ON public.coupon_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_coupon_history_issued_at
  ON public.coupon_history(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_history_unused_valid_until
  ON public.coupon_history(valid_until)
  WHERE is_used = false AND valid_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.notices (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title varchar(100) NOT NULL,
  content text NOT NULL,
  image_url text,
  is_pinned boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notices_manager_order
  ON public.notices(is_pinned DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  title varchar(100) NOT NULL,
  description text NOT NULL,
  report_type varchar(30) NOT NULL DEFAULT 'app_bug',
  screenshot text,
  status varchar(20) NOT NULL DEFAULT '??',
  created_at timestamptz NOT NULL DEFAULT now(),
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_response text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_customer
  ON public.bug_reports(customer_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status_created
  ON public.bug_reports(status, created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_votes_created_at
  ON public.votes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_active_created
  ON public.votes(is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vote_responses (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vote_id integer NOT NULL REFERENCES public.votes(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  selected_options integer[] NOT NULL,
  voted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vote_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_vote_responses_vote
  ON public.vote_responses(vote_id);
CREATE INDEX IF NOT EXISTS idx_vote_responses_customer
  ON public.vote_responses(customer_id);

-- -----------------------------------------------------------------------------
-- RLS: every public table is protected; only manager admin JWTs can mutate/read.
-- -----------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.customers,
  public.visit_history,
  public.coupon_history,
  public.notices,
  public.bug_reports,
  public.votes,
  public.vote_responses
TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Remove legacy broad/public policies before creating the manager-only policies.
DROP POLICY IF EXISTS "Allow All Select" ON public.customers;
DROP POLICY IF EXISTS "Allow All Insert" ON public.customers;
DROP POLICY IF EXISTS "Allow All Update" ON public.customers;
DROP POLICY IF EXISTS "Allow All Delete" ON public.customers;
DROP POLICY IF EXISTS "Allow All Select" ON public.visit_history;
DROP POLICY IF EXISTS "Allow All Insert" ON public.visit_history;
DROP POLICY IF EXISTS "Allow All Update" ON public.visit_history;
DROP POLICY IF EXISTS "Allow All Delete" ON public.visit_history;
DROP POLICY IF EXISTS "Allow All Select" ON public.coupon_history;
DROP POLICY IF EXISTS "Allow All Insert" ON public.coupon_history;
DROP POLICY IF EXISTS "Allow All Update" ON public.coupon_history;
DROP POLICY IF EXISTS "Allow All Delete" ON public.coupon_history;
DROP POLICY IF EXISTS "Allow All Select" ON public.notices;
DROP POLICY IF EXISTS "Allow All Insert" ON public.notices;
DROP POLICY IF EXISTS "Allow All Update" ON public.notices;
DROP POLICY IF EXISTS "Allow All Delete" ON public.notices;
DROP POLICY IF EXISTS "Allow All Select" ON public.bug_reports;
DROP POLICY IF EXISTS "Allow All Insert" ON public.bug_reports;
DROP POLICY IF EXISTS "Allow All Update" ON public.bug_reports;
DROP POLICY IF EXISTS "Allow All Delete" ON public.bug_reports;
DROP POLICY IF EXISTS "Allow All Select" ON public.votes;
DROP POLICY IF EXISTS "Allow All Insert" ON public.votes;
DROP POLICY IF EXISTS "Allow All Update" ON public.votes;
DROP POLICY IF EXISTS "Allow All Delete" ON public.votes;
DROP POLICY IF EXISTS "Allow All Select" ON public.vote_responses;
DROP POLICY IF EXISTS "Allow All Insert" ON public.vote_responses;
DROP POLICY IF EXISTS "Allow All Update" ON public.vote_responses;
DROP POLICY IF EXISTS "Allow All Delete" ON public.vote_responses;
DROP POLICY IF EXISTS "Public can read published notices" ON public.notices;
DROP POLICY IF EXISTS "Public can read active votes" ON public.votes;

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

-- -----------------------------------------------------------------------------
-- The only RPC currently called by src/components/CustomerView.js.
-- SECURITY DEFINER is used only to hash and insert the manager-created customer;
-- execute permission is restricted to authenticated manager JWTs and the function
-- also checks public.is_admin() explicitly.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_customer(
  p_phone text,
  p_password text,
  p_nickname text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_nickname text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Admin privileges are required.');
  END IF;

  IF p_phone IS NULL OR p_phone !~ '^\d{3}-\d{3,4}-\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid phone format. Use 010-1234-5678.');
  END IF;

  IF p_password IS NULL OR length(p_password) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Password is required.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.customers
    WHERE phone_number = p_phone
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Phone number already registered.');
  END IF;

  v_nickname := COALESCE(NULLIF(trim(p_nickname), ''), '??');

  INSERT INTO public.customers (
    phone_number,
    password,
    nickname,
    must_change_password
  )
  VALUES (
    p_phone,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    v_nickname,
    p_password = '123456'
  )
  RETURNING id INTO v_customer_id;

  RETURN jsonb_build_object('success', true, 'id', v_customer_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.register_customer(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_customer(text, text, text) TO authenticated;
