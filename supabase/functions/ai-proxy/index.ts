// Supabase Edge Function: ai-proxy
// Deploy example: supabase functions deploy ai-proxy

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')?.trim() ?? '';
// 사용자 요청에 따라 'gemma-3-12b-it'을 기본 모델로 설정합니다.
const GOOGLE_MODEL = Deno.env.get('GOOGLE_MODEL')?.trim() || 'gemma-3-12b-it';

const REQUIRE_AUTH = (Deno.env.get('AI_PROXY_REQUIRE_AUTH') || 'false').toLowerCase() === 'true';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function callGoogle(messages: any[], temperature = 0.7, maxTokens = 1000) {
  if (!GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY not configured');
  }

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

  console.log(`[AI Proxy] Calling Google API: ${GOOGLE_MODEL}`);

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
    console.error('[AI Proxy] Google API Error:', payload);
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

// OpenAI 호출 기능은 제거하였습니다 (Google API만 사용하도록 통일)
// (기존 callOpenAI 함수 삭제됨)

Deno.serve(async (req) => {
  // CORS Preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 인증 체크
    if (REQUIRE_AUTH && !req.headers.get('authorization')) {
      console.warn('[AI Proxy] Unauthorized request: Missing authorization header');
      return new Response(
        JSON.stringify({ error: '인증 정보가 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 요청 파싱 확인
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error('[AI Proxy] JSON parse error:', e);
      return new Response(
        JSON.stringify({ error: '잘못된 요청 형식입니다. JSON 데이터가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { task, messages, options } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages는 1개 이상 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const temperature = Number(options?.temperature ?? 0.7);
    const maxTokens = Number(options?.maxTokens ?? 1000);

    // Google API를 유일한 AI 제공자로 사용합니다.
    try {
      if (!GOOGLE_API_KEY) {
        throw new Error('GOOGLE_API_KEY가 설정되지 않았습니다. Supabase Secrets를 확인해주세요.');
      }

      const googleResult = await callGoogle(messages, temperature, maxTokens);
      return new Response(JSON.stringify(googleResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (googleError) {
      console.error('[AI Proxy] Business Logic Error:', googleError);

      // 클라이언트가 'non-2xx' 에러로 인식하지 않도록 에러 발생 시에도 200을 반환할 수 있으나,
      // 실제 애플리케이션의 에러 핸들링 로직에 맞춰 200 또는 적절한 에러 코드를 선택합니다.
      // 여기서는 기존 로직대로 200을 반환하여 상세 에러 메시지를 전달합니다.
      return new Response(JSON.stringify({
        data: '',
        usage: null,
        provider: 'google-gemma',
        error: googleError instanceof Error ? googleError.message : 'AI 서비스 호출에 실패했습니다.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('[AI Proxy] Unexpected Global Error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
