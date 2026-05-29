-- Replace Edge Function rate/token quotas with app-visible monthly numeric AI usage.

DROP FUNCTION IF EXISTS public.increment_ai_proxy_rate_limit(text, text, text, timestamptz, integer) CASCADE;
DROP FUNCTION IF EXISTS public.apply_ai_proxy_token_usage(uuid, date, text, bigint, bigint, bigint) CASCADE;
DROP TABLE IF EXISTS public.ai_proxy_token_quotas CASCADE;
DROP TABLE IF EXISTS public.ai_proxy_rate_limits CASCADE;

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
  ON CONFLICT (customer_id, month_bucket, usage_type)
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
