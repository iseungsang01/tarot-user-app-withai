-- Remove legacy public/permissive vote response policies left by older schema syncs.
-- Customer app access now goes through session-token RPCs; authenticated direct
-- table access remains limited to owner rows or admins.

REVOKE ALL ON TABLE public.vote_responses FROM anon;

DROP POLICY IF EXISTS "Vote Responses SELECT" ON public.vote_responses;
DROP POLICY IF EXISTS "Vote Responses INSERT" ON public.vote_responses;
DROP POLICY IF EXISTS "Vote Responses UPDATE" ON public.vote_responses;
DROP POLICY IF EXISTS "Vote Responses DELETE" ON public.vote_responses;

DROP POLICY IF EXISTS "Vote responses owner select" ON public.vote_responses;
DROP POLICY IF EXISTS "Vote responses owner insert" ON public.vote_responses;
DROP POLICY IF EXISTS "Vote responses owner update" ON public.vote_responses;
DROP POLICY IF EXISTS "Vote responses owner delete" ON public.vote_responses;

CREATE POLICY "Vote responses owner select" ON public.vote_responses
FOR SELECT TO authenticated USING (customer_id = (select auth.uid()));
CREATE POLICY "Vote responses owner insert" ON public.vote_responses
FOR INSERT TO authenticated WITH CHECK (customer_id = (select auth.uid()));
CREATE POLICY "Vote responses owner update" ON public.vote_responses
FOR UPDATE TO authenticated USING (customer_id = (select auth.uid())) WITH CHECK (customer_id = (select auth.uid()));
CREATE POLICY "Vote responses owner delete" ON public.vote_responses
FOR DELETE TO authenticated USING (customer_id = (select auth.uid()));
