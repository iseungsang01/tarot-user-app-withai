import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { buildTaskRequest, type TaskRequest } from './tasks.ts';

// Supabase Edge Function: ai-proxy
// Deploy example: supabase functions deploy ai-proxy

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')?.trim() ?? '';
const GOOGLE_MODEL = Deno.env.get('GOOGLE_MODEL')?.trim() || 'gemma-4-31b-it';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-customer-session-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BODY_BYTES = 64 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status = 400) {
  return json({ error: message }, status);
}

function requireEnv(name: string, value: string) {
  if (!value) {
    throw new Error(`${name} not configured`);
  }
}

function getCustomerSessionToken(req: Request) {
  const custom = req.headers.get('x-customer-session-token')?.trim();
  if (custom) return custom;
  const raw = req.headers.get('authorization')?.trim() ?? '';
  return raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : '';
}

/**
 * 클라이언트 IP. x-forwarded-for 첫 항목은 클라이언트가 끼워 넣을 수 있어
 * Cloudflare 가 채우는 cf-connecting-ip 를 먼저 본다. 위조돼도 회원·게스트별 한도는 남는다.
 */
function getClientIp(req: Request) {
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || '';
  return ip.trim().slice(0, 64);
}

async function callGoogle({ system, user, temperature, maxTokens, responseSchema }: TaskRequest) {
  requireEnv('GOOGLE_API_KEY', GOOGLE_API_KEY);

  // 키는 URL 쿼리(?key=)가 아니라 헤더로 보낸다. URL 은 프록시·로그에 남는다.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent`;
  const contents = [{ role: 'user', parts: [{ text: user }] }];
  const baseConfig = { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' };
  const systemInstruction = { role: 'system', parts: [{ text: system }] };

  const post = async (body: unknown) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GOOGLE_API_KEY },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  let { response, payload } = await post({
    contents,
    generationConfig: { ...baseConfig, responseJsonSchema: responseSchema },
    systemInstruction,
  });

  if (!response.ok) {
    // 모델에 따라 responseJsonSchema 나 systemInstruction 을 거부한다. 거부된 쪽만 빼고 한 번 더 보낸다.
    const message = payload?.error?.message || '';
    const systemInstructionRejected = /systemInstruction|system instruction/i.test(message);
    const schemaRejected = /response(Json)?Schema|schema|generationConfig/i.test(message);

    if (systemInstructionRejected) {
      ({ response, payload } = await post({
        contents: [{ role: 'user', parts: [{ text: `[System instruction]\n${system}\n\n[User input]\n${user}` }] }],
        generationConfig: baseConfig,
      }));
    } else if (schemaRejected) {
      ({ response, payload } = await post({ contents, generationConfig: baseConfig, systemInstruction }));
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Google AI request failed with status ${response.status}`);
  }

  const text = (payload?.candidates?.[0]?.content?.parts || [])
    .map((part: { text?: string }) => part?.text || '')
    .join('');

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
  if (req.method !== 'POST') {
    return jsonError('Method not allowed.', 405);
  }

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError('Request body is too large.', 413);
  }

  try {
    requireEnv('SUPABASE_URL', SUPABASE_URL);
    requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);

    const token = getCustomerSessionToken(req);
    if (!token) {
      return jsonError('Authentication information is required.', 401);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: sessionData, error: sessionError } = await adminClient.rpc('resolve_ai_proxy_session', {
      p_session_token: token,
    });
    if (sessionError) throw sessionError;
    if (!sessionData?.success || !sessionData?.user_id) {
      return jsonError('Invalid or expired authentication token.', 401);
    }

    // 사용량은 DB 에서 센다. isolate 메모리 카운터는 콜드스타트·다중 인스턴스마다
    // 0 으로 돌아가서 한도 역할을 못 했다. 검증 실패 요청도 한도를 소모한다.
    const { data: quota, error: quotaError } = await adminClient.rpc('consume_ai_proxy_quota', {
      p_subject: String(sessionData.user_id),
      p_client_ip: getClientIp(req),
    });
    if (quotaError) throw quotaError;
    if (!quota?.allowed) {
      return jsonError('AI 사용 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.', 429);
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      return jsonError('Request body is too large.', 413);
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonError('Invalid request format. JSON data is required.', 400);
    }

    const built = buildTaskRequest(body?.task, body?.input);
    if (!built.ok) {
      return jsonError(built.error, 400);
    }

    return json(await callGoogle(built.request));
  } catch (error) {
    // 상세 원인(환경변수 누락, 업스트림 오류 문구 등)은 로그에만 남긴다.
    console.error('ai-proxy failed:', error);
    return jsonError('AI 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', 502);
  }
});
