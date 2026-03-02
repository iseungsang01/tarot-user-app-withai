-- Remove legacy permissive policies and enforce owner/public-read access model.

-- 1) Tighten default privileges (least privilege)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- 2) Remove broad table grants for anon/authenticated
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- public read scopes
GRANT SELECT ON public.notices TO anon, authenticated;
GRANT SELECT ON public.votes TO anon, authenticated;

-- owner-managed domains for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bug_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vote_responses TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 3) Remove all legacy Allow All policies
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

-- 4) Recreate policy set for target tables
DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers can insert own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers can update own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers can delete own profile" ON public.customers;

CREATE POLICY "Customers can view own profile" ON public.customers
FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Customers can insert own profile" ON public.customers
FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Customers can update own profile" ON public.customers
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Customers can delete own profile" ON public.customers
FOR DELETE TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Visit history owner select" ON public.visit_history;
DROP POLICY IF EXISTS "Visit history owner insert" ON public.visit_history;
DROP POLICY IF EXISTS "Visit history owner update" ON public.visit_history;
DROP POLICY IF EXISTS "Visit history owner delete" ON public.visit_history;

CREATE POLICY "Visit history owner select" ON public.visit_history
FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Visit history owner insert" ON public.visit_history
FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Visit history owner update" ON public.visit_history
FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Visit history owner delete" ON public.visit_history
FOR DELETE TO authenticated USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Coupon history owner select" ON public.coupon_history;
DROP POLICY IF EXISTS "Coupon history owner insert" ON public.coupon_history;
DROP POLICY IF EXISTS "Coupon history owner update" ON public.coupon_history;
DROP POLICY IF EXISTS "Coupon history owner delete" ON public.coupon_history;

CREATE POLICY "Coupon history owner select" ON public.coupon_history
FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Coupon history owner insert" ON public.coupon_history
FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Coupon history owner update" ON public.coupon_history
FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Coupon history owner delete" ON public.coupon_history
FOR DELETE TO authenticated USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Bug reports owner select" ON public.bug_reports;
DROP POLICY IF EXISTS "Bug reports owner insert" ON public.bug_reports;
DROP POLICY IF EXISTS "Bug reports owner update" ON public.bug_reports;
DROP POLICY IF EXISTS "Bug reports owner delete" ON public.bug_reports;

CREATE POLICY "Bug reports owner select" ON public.bug_reports
FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Bug reports owner insert" ON public.bug_reports
FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Bug reports owner update" ON public.bug_reports
FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Bug reports owner delete" ON public.bug_reports
FOR DELETE TO authenticated USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Vote responses owner select" ON public.vote_responses;
DROP POLICY IF EXISTS "Vote responses owner insert" ON public.vote_responses;
DROP POLICY IF EXISTS "Vote responses owner update" ON public.vote_responses;
DROP POLICY IF EXISTS "Vote responses owner delete" ON public.vote_responses;

CREATE POLICY "Vote responses owner select" ON public.vote_responses
FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Vote responses owner insert" ON public.vote_responses
FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Vote responses owner update" ON public.vote_responses
FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Vote responses owner delete" ON public.vote_responses
FOR DELETE TO authenticated USING (customer_id = auth.uid());

-- 5) Explicit anon read-only policy for notices
DROP POLICY IF EXISTS "Public can read published notices" ON public.notices;
CREATE POLICY "Public can read published notices" ON public.notices
FOR SELECT TO anon, authenticated USING (is_published = true);
