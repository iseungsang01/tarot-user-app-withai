import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

// Supabase Edge Function: ai-proxy
// Deploy example: supabase functions deploy ai-proxy

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')?.trim() ?? '';
const GOOGLE_MODEL = Deno.env.get('GOOGLE_MODEL')?.trim() || 'gemini-2.5-flash';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';

const REQUIRE_AUTH = (Deno.env.get('AI_PROXY_REQUIRE_AUTH') || 'true').toLowerCase() !== 'false';
const RATE_LIMIT_PER_MINUTE = Number(Deno.env.get('AI_PROXY_RATE_LIMIT_PER_MINUTE') ?? '20');
const RATE_LIMIT_PER_HOUR = Number(Deno.env.get('AI_PROXY_RATE_LIMIT_PER_HOUR') ?? '200');
const DAILY_TOKEN_QUOTA = Number(Deno.env.get('AI_PROXY_DAILY_TOKEN_QUOTA') ?? '50000');
const MONTHLY_TOKEN_QUOTA = Number(Deno.env.get('AI_PROXY_MONTHLY_TOKEN_QUOTA') ?? '1000000');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function requireEnv(name: string, value: string) {
  if (!value) {
    throw new Error(`${name} not configured`);
  }
}

function getBearerToken(req: Request) {
  const raw = req.headers.get('authorization')?.trim() ?? '';
  if (!raw.toLowerCase().startsWith('bearer ')) {
    return '';
  }
  return raw.slice(7).trim();
}

function getBucketStart(date: Date, bucketType: 'minute' | 'hour') {
  const clone = new Date(date);
  clone.setUTCSeconds(0, 0);
  if (bucketType === 'hour') {
    clone.setUTCMinutes(0, 0, 0);
  }
  return clone.toISOString();
}

function getIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function callGoogle(messages: any[], temperature = 0.7, maxTokens = 1000) {
  requireEnv('GOOGLE_API_KEY', GOOGLE_API_KEY);

  const system = messages.find((m) => m.role === 'system')?.content || '';
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: '대화를 시작합니다.' }] });
  }

  if (system && contents[0]?.role === 'user') {
    contents[0].parts[0].text = `[시스템 지침]\n${system}\n\n---\n\n${contents[0].parts[0].text}`;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Google AI request failed with status ${response.status}`;
    throw new Error(message);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return {
    data: text,
    usage: payload?.usageMetadata || null,
    provider: 'google-gemma',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    requireEnv('SUPABASE_URL', SUPABASE_URL);
    requireEnv('SUPABASE_ANON_KEY', SUPABASE_ANON_KEY);
    requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);

    const token = getBearerToken(req);
    if (REQUIRE_AUTH && !token) {
      return new Response(
        JSON.stringify({ error: '인증 정보가 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let userId: string | null = null;
    if (token) {
      const { data, error } = await authClient.auth.getUser(token);
      if (!error && data.user) {
        userId = data.user.id;
      } else {
        const { data: profileData, error: profileError } = await adminClient.rpc('get_my_profile', {
          p_session_token: token,
        });
        const customerId = profileData?.customer?.id || profileData?.id || null;
        if (!profileError && profileData?.success && customerId) {
          userId = customerId;
        }
      }
    }

    if (REQUIRE_AUTH && !userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired authentication token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: '잘못된 요청 형식입니다. JSON 데이터가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { messages, options } = body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages는 1개 이상 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    for (const msg of messages) {
      if (!msg || typeof msg !== 'object') {
        return new Response(
          JSON.stringify({ error: '각 메시지는 객체여야 합니다.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (typeof msg.role !== 'string' || !['user', 'assistant', 'system'].includes(msg.role)) {
        return new Response(
          JSON.stringify({ error: '유효하지 않은 role입니다 (user, assistant, system 중 하나).' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (typeof msg.content !== 'string' || msg.content.trim() === '') {
        return new Response(
          JSON.stringify({ error: '메시지 content가 비어 있거나 문자열이 아닙니다.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (msg.content.length > 50000) {
        return new Response(
          JSON.stringify({ error: '메시지 길이가 너무 깁니다 (최대 50000자).' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const deviceId = req.headers.get('x-device-id')?.trim() || body?.deviceId || 'unknown-device';
    const now = new Date();

    const rateChecks = [
      { dimension: 'user', identifier: userId ?? 'anonymous', bucketType: 'minute', limitValue: RATE_LIMIT_PER_MINUTE },
      { dimension: 'device', identifier: deviceId, bucketType: 'minute', limitValue: RATE_LIMIT_PER_MINUTE },
      { dimension: 'user_hour', identifier: userId ?? 'anonymous', bucketType: 'hour', limitValue: RATE_LIMIT_PER_HOUR },
    ];

    for (const check of rateChecks) {
      const { data, error } = await adminClient.rpc('increment_ai_proxy_rate_limit', {
        p_dimension: check.dimension,
        p_identifier: check.identifier,
        p_bucket_type: check.bucketType,
        p_bucket_start: getBucketStart(now, check.bucketType as 'minute' | 'hour'),
        p_limit: check.limitValue,
      });

      if (error) {
        console.error('[AI Proxy] Rate limit check error', error);
        return new Response(
          JSON.stringify({ error: '요청 제한 확인 중 오류가 발생했습니다.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (!data?.allowed) {
        return new Response(
          JSON.stringify({ error: '요청 횟수 제한을 초과했습니다.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const temperature = Number(options?.temperature ?? 0.7);
    const maxTokens = Number(options?.maxTokens ?? 1000);
    const googleResult = await callGoogle(messages, temperature, maxTokens);

    const usage = googleResult.usage ?? {};
    const usedTokens = Number(usage.totalTokenCount ?? usage.totalTokens ?? 0);

    if (userId && usedTokens > 0) {
      const { data, error } = await adminClient.rpc('apply_ai_proxy_token_usage', {
        p_user_id: userId,
        p_day_bucket: getIsoDate(now),
        p_month_bucket: getMonthKey(now),
        p_used_tokens: usedTokens,
        p_daily_limit: DAILY_TOKEN_QUOTA,
        p_monthly_limit: MONTHLY_TOKEN_QUOTA,
      });

      if (error) {
        console.error('[AI Proxy] Quota update error', error);
        return new Response(
          JSON.stringify({ error: '쿼터 확인 중 오류가 발생했습니다.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (!data?.allowed) {
        return new Response(
          JSON.stringify({ error: '토큰 사용량 쿼터를 초과했습니다.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    return new Response(JSON.stringify(googleResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
