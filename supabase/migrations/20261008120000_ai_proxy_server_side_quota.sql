-- AI 프록시 남용 차단: 사용량을 DB 에서 세고, 게스트 세션 발급에 한도를 건다.
--
-- 왜: issue_ai_guest_session 은 anon 에 무제한 공개라 호출 한 번이면 AI 세션이
-- 생긴다. ai-proxy 의 분당 한도는 Edge isolate 메모리 Map 이어서 콜드스타트·다중
-- 인스턴스마다 0 으로 돌아갔고, 월간 한도는 클라이언트 로컬 저장소에만 있었다.
-- 세션을 새로 받거나 isolate 가 바뀌면 한도가 사라져 Google API 비용에 상한이 없었다.
--
-- 이 파일의 객체는 모두 유저앱 단독 소유다(ai_guest_sessions 계열).
-- 적용 순서: 이 마이그레이션 → ai-proxy 재배포 → 앱 배포.
--   새 ai-proxy 는 consume_ai_proxy_quota 가 없으면 502 를 낸다.

-- ── 1. 고정 창 카운터 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_proxy_rate_counters (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

ALTER TABLE public.ai_proxy_rate_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No Direct Access ai_proxy_rate_counters" ON public.ai_proxy_rate_counters;
CREATE POLICY "No Direct Access ai_proxy_rate_counters" ON public.ai_proxy_rate_counters FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.ai_proxy_rate_counters FROM anon, authenticated;

-- 이번 창의 카운터를 1 올리고 한도 이내면 true. 거부된 호출도 센다.
CREATE OR REPLACE FUNCTION public.hit_ai_rate_counter(p_bucket text, p_window interval, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_seconds double precision := extract(epoch FROM p_window);
  v_window_start timestamptz;
  v_hits integer;
BEGIN
  v_window_start := to_timestamp(floor(extract(epoch FROM now()) / v_window_seconds) * v_window_seconds);

  INSERT INTO public.ai_proxy_rate_counters AS c (bucket, window_start, hits)
  VALUES (p_bucket, v_window_start, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET hits = c.hits + 1
  RETURNING hits INTO v_hits;

  RETURN v_hits <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.hit_ai_rate_counter(text, interval, integer) FROM PUBLIC, anon, authenticated;

-- ── 2. ai-proxy 한도 (service_role 전용) ──────────────────────────────
-- p_subject 는 resolve_ai_proxy_session 의 user_id(회원 uuid 또는 'guest:<id>').
-- 게스트는 세션을 새로 받으면 개인 한도가 초기화되므로 게스트 전체 일일 한도가
-- 비용 상한 역할을 한다. 통신사 CGNAT 로 여러 사용자가 IP 하나를 공유하니
-- IP 한도는 넉넉하게 둔다.
CREATE OR REPLACE FUNCTION public.consume_ai_proxy_quota(p_subject text, p_client_ip text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_guest boolean := p_subject LIKE 'guest:%';
BEGIN
  IF p_subject IS NULL OR length(p_subject) = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_subject');
  END IF;

  IF NOT public.hit_ai_rate_counter('subject:' || p_subject || ':minute', interval '1 minute', 6) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subject_minute');
  END IF;

  IF NOT public.hit_ai_rate_counter('subject:' || p_subject || ':day', interval '1 day',
                                    CASE WHEN v_is_guest THEN 20 ELSE 60 END) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subject_day');
  END IF;

  IF COALESCE(p_client_ip, '') <> ''
     AND NOT public.hit_ai_rate_counter('ip:' || p_client_ip || ':minute', interval '1 minute', 30) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'ip_minute');
  END IF;

  IF v_is_guest AND NOT public.hit_ai_rate_counter('guests:day', interval '1 day', 2000) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'guests_day');
  END IF;

  -- 지난 창은 가끔 지운다. 일일 창이 가장 길어서 2일이면 충분하다.
  IF random() < 0.01 THEN
    DELETE FROM public.ai_proxy_rate_counters WHERE window_start < now() - interval '2 days';
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_proxy_quota(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_proxy_quota(text, text) TO service_role;

-- ── 3. 게스트 세션 발급 한도 ──────────────────────────────────────────
-- PostgREST 가 넘기는 request.headers 에서 클라이언트 IP 를 읽는다. x-forwarded-for 는
-- 클라이언트가 앞에 값을 끼워 넣을 수 있어 Cloudflare 가 채우는 cf-connecting-ip 를 먼저 본다.
-- IP 를 위조당해도 전체 한도(guest_issue:all)가 상한으로 남는다. 헤더가 없으면
-- IP 한도는 건너뛰고 전체 한도만 적용한다(모든 게스트가 한 버킷에 묶이지 않게).
CREATE OR REPLACE FUNCTION public.issue_ai_guest_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session_token text;
  v_expires_at timestamptz := now() + interval '1 day';
  v_client_ip text;
  v_headers json;
BEGIN
  v_headers := NULLIF(current_setting('request.headers', true), '')::json;
  v_client_ip := COALESCE(
    NULLIF(btrim(v_headers ->> 'cf-connecting-ip'), ''),
    NULLIF(btrim(split_part(COALESCE(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''));

  IF (v_client_ip IS NOT NULL
      AND NOT public.hit_ai_rate_counter('guest_issue:ip:' || left(v_client_ip, 64), interval '1 hour', 10))
     OR NOT public.hit_ai_rate_counter('guest_issue:all', interval '1 hour', 300) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'GUEST_RATE_LIMITED',
      'message', '게스트 로그인 요청이 많습니다. 잠시 후 다시 시도해주세요.'
    );
  END IF;

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

GRANT EXECUTE ON FUNCTION public.issue_ai_guest_session() TO anon, authenticated;

-- ── 4. resolve_ai_proxy_session 은 ai-proxy(service_role)만 부른다 ─────
-- 앱은 이 함수를 직접 부르지 않는다. anon 에 열어둘 이유가 없다.
REVOKE ALL ON FUNCTION public.resolve_ai_proxy_session(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_ai_proxy_session(text) TO service_role;
