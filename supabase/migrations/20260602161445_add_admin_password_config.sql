CREATE TABLE IF NOT EXISTS public.app_configs (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No Direct Access app_configs" ON public.app_configs;
CREATE POLICY "No Direct Access app_configs"
ON public.app_configs
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

REVOKE ALL ON public.app_configs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_admin_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hashed_password text;
BEGIN
  SELECT value INTO v_hashed_password
  FROM public.app_configs
  WHERE key = 'admin_password';

  RETURN p_password IS NOT NULL
     AND btrim(p_password) <> ''
     AND v_hashed_password IS NOT NULL
     AND v_hashed_password = extensions.crypt(p_password, v_hashed_password);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_admin_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_admin_password(text) TO anon, authenticated;
