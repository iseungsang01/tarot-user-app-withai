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

function jsonError(message: string, status = 400, code?: string) {
  return json(code ? { error: message, code } : { error: message }, status);
}

const QUOTA_REJECTIONS: Record<string, { status: number; code: string; message: string }> = {
  ad_required: { status: 403, code: 'AD_REQUIRED', message: '광고 시청이 완료되어야 다시 뽑을 수 있습니다.' },
  ad_pending: { status: 409, code: 'AD_PENDING', message: '광고 시청 확인을 기다리고 있습니다.' },
};

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

/**
 * 본문을 MAX_BODY_BYTES 까지만 읽는다. Content-Length 없는 chunked 요청은 헤더 검사를
 * 지나가고 req.text() 는 끝까지 메모리에 올리므로, 세면서 읽다가 넘으면 끊는다.
 */
async function readBodyLimited(req: Request): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
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

    const rawBody = await readBodyLimited(req);
    if (rawBody === null) {
      return jsonError('Request body is too large.', 413);
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonError('Invalid request format. JSON data is required.', 400);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: sessionData, error: sessionError } = await adminClient.rpc('resolve_ai_proxy_session', {
      p_session_token: token,
    });
    if (sessionError) throw sessionError;
    if (!sessionData?.success || !sessionData?.user_id) {
      return jsonError('Invalid or expired authentication token.', 401);
    }

    const subject = String(sessionData.user_id);

    // 보상형 광고에 실을 일회용 nonce. 광고를 끝까지 보면 admob-ssv 가 이 nonce 에
    // 보상을 기록하고, 오늘의 운세 다시 뽑기가 그것을 하나 소모한다.
    if (body?.task === 'issueAdRewardNonce') {
      const { data: issued, error: issueError } = await adminClient.rpc('issue_ad_reward_nonce', { p_subject: subject });
      if (issueError) throw issueError;
      if (!issued?.success) return jsonError('광고 요청이 너무 많습니다. 내일 다시 시도해 주세요.', 429, 'AD_NONCE_LIMITED');
      return json({ nonce: issued.nonce });
    }

    // 사용량은 DB 에서 센다. isolate 메모리 카운터는 콜드스타트·다중 인스턴스마다
    // 0 으로 돌아가서 한도 역할을 못 했다. 검증 실패 요청도 한도를 소모한다.
    // 오늘의 운세는 오늘(KST) 두 번째 뽑기부터 보상된 광고 nonce 가 있어야 한다.
    const adNonce = typeof body?.input?.adNonce === 'string' ? body.input.adNonce.slice(0, 64) : null;
    const { data: quota, error: quotaError } = await adminClient.rpc('consume_ai_proxy_quota', {
      p_subject: subject,
      p_client_ip: getClientIp(req),
      p_task: typeof body?.task === 'string' ? body.task.slice(0, 64) : null,
      p_ad_nonce: adNonce,
    });
    if (quotaError) throw quotaError;
    if (!quota?.allowed) {
      const rejection = QUOTA_REJECTIONS[quota?.reason];
      if (rejection) return jsonError(rejection.message, rejection.status, rejection.code);
      return jsonError('AI 사용 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.', 429, 'QUOTA_EXCEEDED');
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
