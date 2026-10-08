-- 오늘의 운세 다시 뽑기를 서버가 광고 시청(AdMob 서버 측 검증)으로 확인한다.
--
-- 왜: "광고 보고 다시 뽑기"를 앱 로컬 drawCount 만 보고 판단했다. 앱 데이터를 지우거나
-- ai-proxy 를 직접 부르면 광고 없이 무제한으로 다시 뽑을 수 있었다.
--
-- 흐름:
--   1) 앱 → ai-proxy {task:'issueAdRewardNonce'} → issue_ad_reward_nonce: 고객(또는 게스트)에
--      묶인 일회용 nonce 발급
--   2) 앱이 그 nonce 를 AdMob serverSideVerificationOptions.customData 로 넣고 보상형 광고 표시
--   3) 광고를 끝까지 보면 Google 이 admob-ssv Edge Function 을 서명된 GET 으로 호출
--      → 서명 검증 후 record_ad_reward 로 nonce 에 보상 표시
--   4) 앱 → ai-proxy {task:'getDailyFortune', input:{adNonce}} → consume_ai_proxy_quota 가
--      오늘(KST) 첫 뽑기는 그냥, 두 번째부터는 보상된 미사용 nonce 를 하나 소모해야 허용
--
-- 게스트도 같은 규칙이다. 게스트·회원이 광고를 보고 개인·전체 AI 한도에 걸리는 것은 허용한다.
-- 이 파일의 객체는 모두 유저앱 단독 소유다.
-- 선행: 20261008150000_account_ops_null_password_and_member_ai_cap.sql
-- 적용 순서: 이 마이그레이션 → ai-proxy·admob-ssv 배포 → 앱 배포.

-- ── 1. 테이블 ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_ad_rewards (
  nonce text PRIMARY KEY,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz,
  transaction_id text UNIQUE,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_ad_rewards_created_at ON public.ai_ad_rewards(created_at);

CREATE TABLE IF NOT EXISTS public.ai_fortune_draws (
  subject text NOT NULL,
  draw_date date NOT NULL,
  draws integer NOT NULL DEFAULT 0,
  PRIMARY KEY (subject, draw_date)
);

ALTER TABLE public.ai_ad_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_fortune_draws ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No Direct Access ai_ad_rewards" ON public.ai_ad_rewards;
CREATE POLICY "No Direct Access ai_ad_rewards" ON public.ai_ad_rewards FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "No Direct Access ai_fortune_draws" ON public.ai_fortune_draws;
CREATE POLICY "No Direct Access ai_fortune_draws" ON public.ai_fortune_draws FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.ai_ad_rewards, public.ai_fortune_draws FROM anon, authenticated;

-- ── 2. nonce 발급 (service_role 전용, ai-proxy 가 부른다) ─────────────
-- 주체당 하루 30개. 광고를 안 보면 nonce 는 쓸모가 없으니 행이 쌓이는 것만 막는다.
CREATE OR REPLACE FUNCTION public.issue_ad_reward_nonce(p_subject text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_nonce text;
BEGIN
  IF p_subject IS NULL OR length(p_subject) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_SUBJECT');
  END IF;

  IF NOT public.hit_ai_rate_counter('ad_nonce:' || p_subject, interval '1 day', 30) THEN
    RETURN jsonb_build_object('success', false, 'code', 'AD_NONCE_LIMITED');
  END IF;

  v_nonce := encode(extensions.gen_random_bytes(16), 'hex');
  INSERT INTO public.ai_ad_rewards (nonce, subject) VALUES (v_nonce, p_subject);

  IF random() < 0.01 THEN
    DELETE FROM public.ai_ad_rewards WHERE created_at < now() - interval '3 days';
    DELETE FROM public.ai_fortune_draws WHERE draw_date < (now() AT TIME ZONE 'Asia/Seoul')::date - 3;
  END IF;

  RETURN jsonb_build_object('success', true, 'nonce', v_nonce);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_ad_reward_nonce(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_ad_reward_nonce(text) TO service_role;

-- ── 3. 보상 기록 (service_role 전용, admob-ssv 가 서명 검증 후 부른다) ──
-- 같은 transaction_id 재전송(구글 재시도·리플레이)은 한 번만 반영한다.
CREATE OR REPLACE FUNCTION public.record_ad_reward(p_nonce text, p_transaction_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_nonce IS NULL OR p_transaction_id IS NULL OR length(p_transaction_id) = 0 THEN
    RETURN false;
  END IF;

  UPDATE public.ai_ad_rewards
  SET rewarded_at = now(), transaction_id = p_transaction_id
  WHERE nonce = p_nonce
    AND rewarded_at IS NULL
    AND created_at > now() - interval '1 hour'
    AND NOT EXISTS (SELECT 1 FROM public.ai_ad_rewards r WHERE r.transaction_id = p_transaction_id);

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.record_ad_reward(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ad_reward(text, text) TO service_role;

-- ── 4. consume_ai_proxy_quota: 오늘의 운세 뽑기 규칙 추가 ─────────────
-- 인자가 늘어서 옛 2인자 판을 지운다. 둘 다 있으면 이름 붙인 2인자 호출이 모호해진다.
DROP FUNCTION IF EXISTS public.consume_ai_proxy_quota(text, text);

CREATE OR REPLACE FUNCTION public.consume_ai_proxy_quota(
  p_subject text,
  p_client_ip text DEFAULT NULL,
  p_task text DEFAULT NULL,
  p_ad_nonce text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_guest boolean := p_subject LIKE 'guest:%';
  v_is_fortune boolean := p_task = 'getDailyFortune';
  v_today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_draws integer := 0;
  v_reward public.ai_ad_rewards%ROWTYPE;
BEGIN
  IF p_subject IS NULL OR length(p_subject) = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_subject');
  END IF;

  -- 오늘의 운세: 오늘(KST) 첫 뽑기는 무료, 그다음부터는 보상된 광고 nonce 가 필요하다.
  -- 광고 판정은 한도 카운터보다 먼저 한다. 콜백 대기 중 재시도가 AI 한도를 깎지 않게.
  IF v_is_fortune THEN
    INSERT INTO public.ai_fortune_draws (subject, draw_date) VALUES (p_subject, v_today)
    ON CONFLICT (subject, draw_date) DO NOTHING;
    SELECT draws INTO v_draws FROM public.ai_fortune_draws
    WHERE subject = p_subject AND draw_date = v_today
    FOR UPDATE;

    IF v_draws >= 1 THEN
      IF p_ad_nonce IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'ad_required');
      END IF;

      SELECT * INTO v_reward FROM public.ai_ad_rewards
      WHERE nonce = p_ad_nonce AND subject = p_subject AND consumed_at IS NULL
        AND created_at > now() - interval '1 hour'
      FOR UPDATE;

      IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'ad_required');
      END IF;
      IF v_reward.rewarded_at IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'ad_pending');
      END IF;
    END IF;
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

  -- 전체 상한이 비용 상한이다. 게스트는 세션을 새로 받으면, 회원은 가입을 새로 하면
  -- 개인 한도가 초기화된다.
  IF v_is_guest AND NOT public.hit_ai_rate_counter('guests:day', interval '1 day', 2000) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'guests_day');
  END IF;

  IF NOT v_is_guest AND NOT public.hit_ai_rate_counter('members:day', interval '1 day', 5000) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'members_day');
  END IF;

  -- 한도를 모두 통과했을 때만 뽑기·광고 보상을 소모한다.
  IF v_is_fortune THEN
    IF v_draws >= 1 THEN
      UPDATE public.ai_ad_rewards SET consumed_at = now() WHERE nonce = p_ad_nonce;
    END IF;
    UPDATE public.ai_fortune_draws SET draws = draws + 1
    WHERE subject = p_subject AND draw_date = v_today;
  END IF;

  -- 지난 창은 가끔 지운다. 일일 창이 가장 길어서 2일이면 충분하다.
  IF random() < 0.01 THEN
    DELETE FROM public.ai_proxy_rate_counters WHERE window_start < now() - interval '2 days';
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_proxy_quota(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_proxy_quota(text, text, text, text) TO service_role;
