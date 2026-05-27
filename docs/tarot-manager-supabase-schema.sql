-- Tarot Manager App - Supabase schema for sharing
-- Generated from the tables/columns used by tarot-manager-app.
-- Scope: manager app CRUD tables + RLS needed by src/supabaseClient.js admin JWT flow.
-- Not included: old customer-auth RPCs, app_configs admin password storage, AI proxy tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number varchar(13) NOT NULL,
  nickname varchar(20),
  -- Current manager app creates customers without a password. Keep this column for
  -- compatibility with older/customer-facing projects, but do not require input here.
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
  is_deleted boolean NOT NULL DEFAULT false
);

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
