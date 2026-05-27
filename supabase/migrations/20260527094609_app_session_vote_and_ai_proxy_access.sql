-- Customer app sessions are opaque RPC tokens, not Supabase Auth JWTs.
-- Keep vote_responses private behind SECURITY DEFINER RPCs that validate the
-- customer_sessions token before reading or mutating owner-scoped rows.

CREATE OR REPLACE FUNCTION public.resolve_customer_session(p_session_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  IF p_session_token IS NULL OR length(trim(p_session_token)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT s.customer_id INTO v_customer_id
  FROM public.customer_sessions s
  JOIN public.customers c ON c.id = s.customer_id
  WHERE s.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND c.deleted_at IS NULL;

  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customer_sessions
    SET last_used_at = now()
    WHERE token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex');
  END IF;

  RETURN v_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_customer_session(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_vote_responses(p_session_token text)
RETURNS SETOF public.vote_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT vr.*
  FROM public.vote_responses vr
  WHERE vr.customer_id = v_customer_id
  ORDER BY vr.voted_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_vote_response(p_session_token text, p_vote_id integer)
RETURNS public.vote_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_response public.vote_responses%ROWTYPE;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_response
  FROM public.vote_responses
  WHERE vote_id = p_vote_id
    AND customer_id = v_customer_id;

  IF v_response.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_vote_response(
  p_session_token text,
  p_vote_id integer,
  p_selected_options integer[],
  p_response_id integer DEFAULT NULL
)
RETURNS public.vote_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_vote public.votes%ROWTYPE;
  v_response public.vote_responses%ROWTYPE;
  v_selection_count integer;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_vote
  FROM public.votes
  WHERE id = p_vote_id
    AND is_active = true
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now());

  IF v_vote.id IS NULL THEN
    RAISE EXCEPTION 'Vote is not active' USING ERRCODE = '22023';
  END IF;

  v_selection_count := COALESCE(array_length(p_selected_options, 1), 0);
  IF v_selection_count = 0 THEN
    RAISE EXCEPTION 'At least one option is required' USING ERRCODE = '22023';
  END IF;

  IF NOT COALESCE(v_vote.allow_multiple, false) AND v_selection_count > 1 THEN
    RAISE EXCEPTION 'Multiple selections are not allowed' USING ERRCODE = '22023';
  END IF;

  IF v_vote.max_selections IS NOT NULL AND v_selection_count > v_vote.max_selections THEN
    RAISE EXCEPTION 'Too many selections' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_selected_options) AS selected_option
    WHERE selected_option < 0
  ) THEN
    RAISE EXCEPTION 'Invalid selected option' USING ERRCODE = '22023';
  END IF;

  IF p_response_id IS NOT NULL THEN
    UPDATE public.vote_responses
    SET selected_options = p_selected_options,
        voted_at = now()
    WHERE id = p_response_id
      AND vote_id = p_vote_id
      AND customer_id = v_customer_id
    RETURNING * INTO v_response;

    IF v_response.id IS NULL THEN
      RAISE EXCEPTION 'Vote response not found' USING ERRCODE = '02000';
    END IF;
  ELSE
    INSERT INTO public.vote_responses (vote_id, customer_id, selected_options)
    VALUES (p_vote_id, v_customer_id, p_selected_options)
    ON CONFLICT (vote_id, customer_id)
    DO UPDATE SET selected_options = EXCLUDED.selected_options,
                  voted_at = now()
    RETURNING * INTO v_response;
  END IF;

  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_vote_response(p_session_token text, p_vote_id integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  v_customer_id := public.resolve_customer_session(p_session_token);
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer session' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.vote_responses
  WHERE vote_id = p_vote_id
    AND customer_id = v_customer_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vote_summary(p_vote_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_results jsonb;
  v_count integer;
BEGIN
  SELECT COALESCE(jsonb_object_agg(option_id::text, option_count), '{}'::jsonb)
  INTO v_results
  FROM (
    SELECT selected_option AS option_id, count(*) AS option_count
    FROM public.vote_responses vr
    CROSS JOIN LATERAL unnest(vr.selected_options) AS selected_option
    WHERE vr.vote_id = p_vote_id
    GROUP BY selected_option
  ) counts;

  SELECT count(*) INTO v_count
  FROM public.vote_responses
  WHERE vote_id = p_vote_id;

  RETURN jsonb_build_object('results', COALESCE(v_results, '{}'::jsonb), 'count', COALESCE(v_count, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_vote_responses(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_vote_response(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_vote_response(text, integer, integer[], integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_vote_response(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vote_summary(integer) TO anon, authenticated;
