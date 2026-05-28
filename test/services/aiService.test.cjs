const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

test('aiService: JSON 파싱 실패 시 fallback 응답을 반환한다', async () => {
  const supabaseClient = {
    invokeAIProxy: async () => ({ data: { data: '일반 텍스트 응답', usage: {}, provider: 'mock' }, error: null }),
  };

  const { summarizeReview } = loadModule('src/services/aiService.js', {
    './supabaseClient': { supabaseClient },
    './supabase': { 
      supabase: { 
        functions: { 
          invoke: async () => ({ data: { data: '일반 텍스트 응답', usage: {}, provider: 'mock' }, error: null }) 
        } 
      }, 
      ensureAuthenticatedSession: async () => ({ ok: true, session: { access_token: 'mock_token' } }) 
    },
  });

  const result = await summarizeReview('상담 기록 메모');

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    summary: '일반 텍스트 응답',
    keywords: [],
    mood: '중립',
    moodEmoji: '📝',
    advice: '',
  });
});


test('aiService: surfaces Edge Function JSON error details', async () => {
  const edgeError = new Error('Edge Function returned a non-2xx status code');
  edgeError.name = 'FunctionsHttpError';
  edgeError.context = new Response(JSON.stringify({ error: 'GOOGLE_MODEL not found' }), { status: 500 });

  const { getDailyFortune } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: {
        functions: {
          invoke: async () => ({ data: null, error: edgeError }),
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { access_token: 'mock_token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const result = await getDailyFortune('tester');

  assert.equal(result.data, null);
  assert.equal(result.error.message, 'GOOGLE_MODEL not found');
  assert.equal(result.error.status, 500);
});
