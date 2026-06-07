-- Server-enforced monthly AI quota for the user app.
-- Safe for shared manager/user DB: adds user-app RPC/table and only revokes unsafe legacy uuid-only account RPC grants.

CREATE TABLE IF NOT EXISTS public.ai_monthly_usage (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_key text NOT NULL,
  feature_key text NOT NULL,
  month_key date NOT NULL,
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_key, feature_key, month_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_monthly_usage_user_feature_month
  ON public.ai_monthly_usage(user_key, feature_key, month_key);

ALTER TABLE public.ai_monthly_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No Direct Access ai_monthly_usage" ON public.ai_monthly_usage;
CREATE POLICY "No Direct Access ai_monthly_usage"
  ON public.ai_monthly_usage FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

REVOKE ALL ON public.ai_monthly_usage FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_monthly_usage TO service_role;

CREATE OR REPLACE FUNCTION public.increment_my_ai_monthly_usage(
  p_session_token text,
  p_feature_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session jsonb;
  v_user_key text;
  v_feature_limit integer;
  v_month_key date := date_trunc('month', now())::date;
  v_used integer;
BEGIN
  IF p_feature_key = 'voiceCondense' THEN
    v_feature_limit := 30;
  ELSIF p_feature_key = 'historySummary' THEN
    v_feature_limit := 30;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'allowed', false,
      'feature_key', p_feature_key,
      'limit', 0,
      'used', 0,
      'remaining', 0,
      'reset_month', v_month_key::text,
      'message', '지원하지 않는 AI 기능입니다.'
    );
  END IF;

  v_session := public.resolve_ai_proxy_session(p_session_token);
  IF NOT COALESCE((v_session->>'success')::boolean, false) OR NULLIF(v_session->>'user_id', '') IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'allowed', false,
      'feature_key', p_feature_key,
      'limit', v_feature_limit,
      'used', 0,
      'remaining', 0,
      'reset_month', v_month_key::text,
      'message', '유효한 세션이 필요합니다.'
    );
  END IF;

  v_user_key := v_session->>'user_id';

  INSERT INTO public.ai_monthly_usage (user_key, feature_key, month_key, used_count)
  VALUES (v_user_key, p_feature_key, v_month_key, 1)
  ON CONFLICT (user_key, feature_key, month_key)
  DO UPDATE SET
    used_count = public.ai_monthly_usage.used_count + 1,
    updated_at = now()
  WHERE public.ai_monthly_usage.used_count < v_feature_limit
  RETURNING used_count INTO v_used;

  IF v_used IS NULL THEN
    SELECT used_count INTO v_used
    FROM public.ai_monthly_usage
    WHERE user_key = v_user_key
      AND feature_key = p_feature_key
      AND month_key = v_month_key;

    RETURN jsonb_build_object(
      'success', true,
      'allowed', false,
      'feature_key', p_feature_key,
      'limit', v_feature_limit,
      'used', COALESCE(v_used, v_feature_limit),
      'remaining', 0,
      'reset_month', v_month_key::text,
      'message', '이번 달 AI 사용 횟수를 모두 사용했습니다.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'allowed', true,
    'feature_key', p_feature_key,
    'limit', v_feature_limit,
    'used', v_used,
    'remaining', GREATEST(v_feature_limit - v_used, 0),
    'reset_month', v_month_key::text,
    'message', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.increment_my_ai_monthly_usage(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_my_ai_monthly_usage(text, text) TO anon, authenticated, service_role;

-- Legacy uuid-only sensitive account RPCs are unsafe for anon/authenticated user-app access.
-- Keep the functions present for backward compatibility/DB ownership, but remove direct client execute grants.
REVOKE EXECUTE ON FUNCTION public.update_my_nickname(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_my_account(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.soft_delete_customer(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_password(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_customer_password(uuid, text, text) FROM anon, authenticated;
