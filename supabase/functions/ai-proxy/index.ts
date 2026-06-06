import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

// Supabase Edge Function: ai-proxy
// Deploy example: supabase functions deploy ai-proxy

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')?.trim() ?? '';
const GOOGLE_MODEL = Deno.env.get('GOOGLE_MODEL')?.trim() || 'gemma-4-31b-it';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';

const REQUIRE_AUTH = (Deno.env.get('AI_PROXY_REQUIRE_AUTH') || 'true').toLowerCase() !== 'false';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id, x-customer-session-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// In-memory rate limiter configurations
const rateLimitMap = new Map<string, { tokens: number; lastRefill: number }>();
const MAX_TOKENS = 10;
const REFILL_RATE_MS = 6000; // 6 seconds per token (10 tokens per minute)

// Remove expired entries to prevent memory leak
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [userId, bucket] of rateLimitMap.entries()) {
    if (now - bucket.lastRefill > 5 * 60 * 1000) {
      rateLimitMap.delete(userId);
    }
  }
}

// Token bucket rate limiter check
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  let bucket = rateLimitMap.get(userId);

  if (!bucket) {
    bucket = { tokens: MAX_TOKENS, lastRefill: now };
  } else {
    const elapsed = now - bucket.lastRefill;
    const refilledTokens = Math.floor(elapsed / REFILL_RATE_MS);
    if (refilledTokens > 0) {
      bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + refilledTokens);
      bucket.lastRefill = bucket.lastRefill + refilledTokens * REFILL_RATE_MS;
    }
  }

  if (bucket.tokens <= 0) {
    rateLimitMap.set(userId, bucket);
    return false;
  }

  bucket.tokens -= 1;
  rateLimitMap.set(userId, bucket);
  return true;
}

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

function getCustomerSessionToken(req: Request) {
  return req.headers.get('x-customer-session-token')?.trim() || getBearerToken(req);
}

type GoogleGenerationConfig = {
  temperature: number;
  maxOutputTokens: number;
  responseMimeType: string;
  responseJsonSchema?: Record<string, unknown>;
};

const responseSchemasByTask: Record<string, Record<string, unknown>> = {
  getDailyFortune: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Core daily message' },
      fortune: { type: 'string', description: 'Daily fortune body' },
      relationship: { type: 'string', description: 'Relationship advice' },
      work: { type: 'string', description: 'Work or study advice' },
      money: { type: 'string', description: 'Money advice' },
      care: { type: 'string', description: 'Care point' },
      action: { type: 'string', description: 'Concrete action for today' },
      luckyColor: { type: 'string', description: 'Lucky color' },
      luckyItem: { type: 'string', description: 'Lucky item' },
    },
    required: ['summary', 'fortune', 'relationship', 'work', 'money', 'care', 'action', 'luckyColor', 'luckyItem'],
    additionalProperties: false,
  },
};


function buildGenerationConfig(task = ''): GoogleGenerationConfig {
  const generationConfig: GoogleGenerationConfig = {
    temperature: 0.7,
    maxOutputTokens: 1000,
    responseMimeType: 'application/json',
  };

  const schema = responseSchemasByTask[task];
  if (schema) {
    generationConfig.responseJsonSchema = schema;
  }

  return generationConfig;
}

async function callGoogle(messages: any[], temperature = 0.7, maxTokens = 1000, task = '') {
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
  const generationConfig = {
    ...buildGenerationConfig(task),
    temperature,
    maxOutputTokens: maxTokens,
  };
  const requestBody = {
    contents,
    generationConfig,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Google AI request failed with status ${response.status}`;
    const schemaRejected = generationConfig.responseJsonSchema &&
      /response(Json)?Schema|schema|generationConfig/i.test(message);

    if (schemaRejected) {
      const fallbackResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
          },
        }),
      });

      const fallbackPayload = await fallbackResponse.json().catch(() => ({}));
      if (!fallbackResponse.ok) {
        const fallbackMessage = fallbackPayload?.error?.message ||
          `Google AI request failed with status ${fallbackResponse.status}`;
        throw new Error(fallbackMessage);
      }

      const fallbackText = (fallbackPayload?.candidates?.[0]?.content?.parts || [])
        .map((part: { text?: string }) => part?.text || '')
        .join('');

      return {
        data: fallbackText,
        usage: fallbackPayload?.usageMetadata || null,
        provider: 'google-gemma',
      };
    }

    throw new Error(message);
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

  // Request size limit verification (max 100KB)
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 100 * 1024) {
    return new Response(
      JSON.stringify({ error: 'Request body is too large. Maximum size is 100KB.' }),
      { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    requireEnv('SUPABASE_URL', SUPABASE_URL);
    requireEnv('SUPABASE_ANON_KEY', SUPABASE_ANON_KEY);
    requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);

    const token = getCustomerSessionToken(req);
    if (REQUIRE_AUTH && !token) {
      return new Response(
        JSON.stringify({ error: '인증 정보가 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let userId: string | null = null;
    if (token) {
      const { data: sessionData, error: sessionError } = await adminClient.rpc('resolve_ai_proxy_session', {
        p_session_token: token,
      });
      if (!sessionError && sessionData?.success && sessionData?.user_id) {
        userId = String(sessionData.user_id);
      }
    }

    if (REQUIRE_AUTH && !userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired authentication token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Rate Limiting (max 10 requests per minute per user)
    if (userId) {
      cleanupRateLimitMap();
      if (!checkRateLimit(userId)) {
        return new Response(
          JSON.stringify({ error: 'Too many requests. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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

    const { messages, options, task } = body;
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

    const temperature = Number(options?.temperature ?? 0.7);
    const maxTokens = Number(options?.maxTokens ?? 1000);
    const googleResult = await callGoogle(messages, temperature, maxTokens, task);

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
