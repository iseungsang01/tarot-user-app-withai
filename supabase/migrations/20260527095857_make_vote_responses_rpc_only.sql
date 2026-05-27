-- Customer clients must not access vote_responses directly.
-- Admin direct access is preserved through the existing is_admin() policy;
-- customer access is exclusively through SECURITY DEFINER RPCs that validate
-- public.customer_sessions tokens.

DROP POLICY IF EXISTS "Vote responses owner select" ON public.vote_responses;
DROP POLICY IF EXISTS "Vote responses owner insert" ON public.vote_responses;
DROP POLICY IF EXISTS "Vote responses owner update" ON public.vote_responses;
DROP POLICY IF EXISTS "Vote responses owner delete" ON public.vote_responses;
