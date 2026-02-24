// Supabase Edge Function: ai-proxy
// Deploy example: supabase functions deploy ai-proxy --no-verify-jwt

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')?.trim() ?? '';
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';

const GEMINI_API_KEY = Deno.env.get('GOOGLE_API_KEY')?.trim() ?? '';
const GEMINI_MODEL = Deno.env.get('GOOGLE_MODEL')?.trim() || 'gemini-1.5-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function callOpenAI(messages: unknown[], temperature = 0.7, maxTokens = 1000) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || 'OpenAI request failed';
    throw new Error(message);
  }

  return {
    data: payload?.choices?.[0]?.message?.content || '',
    usage: payload?.usage || null,
    provider: 'openai',
  };
}

async function callGemini(messages: any[], temperature = 0.7, maxTokens = 1000) {
  if (!GEMINI_API_KEY) {
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
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
    const message = payload?.error?.message || 'Gemini request failed';
    throw new Error(message);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return {
    data: text,
    usage: payload?.usageMetadata || null,
    provider: 'gemini',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, options } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages는 1개 이상 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const temperature = Number(options?.temperature ?? 0.7);
    const maxTokens = Number(options?.maxTokens ?? 1000);

    try {
      const result = await callOpenAI(messages, temperature, maxTokens);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (openAiError) {
      const fallback = await callGemini(messages, temperature, maxTokens);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
