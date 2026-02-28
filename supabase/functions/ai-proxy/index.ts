// Supabase Edge Function: ai-proxy
// Deploy example: supabase functions deploy ai-proxy --no-verify-jwt

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')?.trim() ?? '';
const GOOGLE_MODEL = Deno.env.get('GOOGLE_MODEL')?.trim() || 'gemma-3-27b-it';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const message = payload?.error?.message || 'Google AI request failed';
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
      const result = await callGoogle(messages, temperature, maxTokens);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (providerError) {
      return new Response(JSON.stringify({
        data: '',
        usage: null,
        provider: 'google-gemma',
        error: providerError instanceof Error ? providerError.message : 'Provider request failed',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
