CREATE TABLE IF NOT EXISTS public.ai_guest_sessions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_guest_sessions_valid
  ON public.ai_guest_sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.ai_guest_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No Direct Access ai_guest_sessions" ON public.ai_guest_sessions;
CREATE POLICY "No Direct Access ai_guest_sessions"
ON public.ai_guest_sessions
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

REVOKE ALL ON public.ai_guest_sessions FROM anon, authenticated;

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

GRANT EXECUTE ON FUNCTION public.issue_ai_guest_session() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_ai_proxy_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.logout_ai_guest_session(text) TO anon, authenticated;
