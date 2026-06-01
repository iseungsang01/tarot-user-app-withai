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
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }) 
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
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const result = await getDailyFortune('tester');

  assert.equal(result.data, null);
  assert.equal(result.error.message, 'GOOGLE_MODEL not found');
  assert.equal(result.error.status, 500);
});

test('aiService: daily fortune extracts JSON object from decorated model output', async () => {
  const modelOutput = `오늘의 운세입니다.\n\n\`\`\`json\n{\n  "fortune": "차분하게 기회를 살피면 좋은 하루입니다.",\n  "luckyColor": "남색",\n  "luckyItem": "노트"\n}\n\`\`\``;

  const { getDailyFortune } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: {
        functions: {
          invoke: async () => ({ data: { data: modelOutput, usage: {}, provider: 'mock' }, error: null }),
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const result = await getDailyFortune('tester');

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    fortune: '차분하게 기회를 살피면 좋은 하루입니다.',
    luckyColor: '남색',
    luckyItem: '노트',
  });
});

test('aiService: daily fortune sanitizes malformed JSON-like fortune output', async () => {
  const modelOutput = '```json\\n{ "fortune:1님, 오늘 당신의 길 위에 차분한 기회가 보입니다.", "luckyColor":"보라", "luckyItem":"노트" }\\n```';

  const { getDailyFortune, normalizeDailyFortunePayload } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: {
        functions: {
          invoke: async () => ({ data: { data: modelOutput, usage: {}, provider: 'mock' }, error: null }),
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const result = await getDailyFortune('tester');

  assert.equal(result.error, null);
  assert.equal(result.data.fortune, '1님, 오늘 당신의 길 위에 차분한 기회가 보입니다.');
  assert.equal(result.data.luckyColor, '보라');
  assert.equal(result.data.luckyItem, '노트');
  assert.equal(
    normalizeDailyFortunePayload({ fortune: modelOutput }).fortune,
    '1님, 오늘 당신의 길 위에 차분한 기회가 보입니다.',
  );
});

test('aiService: daily fortune tolerates trailing comma and smart quotes', async () => {
  const modelOutput = '물론입니다. { “fortune”: “문이 열리는 하루입니다.”, “luckyColor”: “아이보리”, “luckyItem”: “펜”, }';

  const { getDailyFortune } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: {
        functions: {
          invoke: async () => ({ data: { data: modelOutput, usage: {}, provider: 'mock' }, error: null }),
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const result = await getDailyFortune('tester');

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    fortune: '문이 열리는 하루입니다.',
    luckyColor: '아이보리',
    luckyItem: '펜',
  });
});

test('aiService: daily fortune raw Korean fallback receives safe lucky defaults', async () => {
  const { getDailyFortune } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: {
        functions: {
          invoke: async () => ({ data: { data: '오늘은 차분하게 기회를 살피면 좋은 하루입니다.', usage: {}, provider: 'mock' }, error: null }),
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const result = await getDailyFortune('tester');

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    fortune: '오늘은 차분하게 기회를 살피면 좋은 하루입니다.',
    luckyColor: '골드',
    luckyItem: '작은 노트',
  });
});

test('aiService: daily fortune repairs raw newline inside JSON string', async () => {
  const modelOutput = '{ "fortune": "첫 문장입니다.\n둘째 문장입니다.", "luckyColor": "골드", "luckyItem": "작은 노트" }';

  const { getDailyFortune } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: {
        functions: {
          invoke: async () => ({ data: { data: modelOutput, usage: {}, provider: 'mock' }, error: null }),
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const result = await getDailyFortune('tester');

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    fortune: '첫 문장입니다.\n둘째 문장입니다.',
    luckyColor: '골드',
    luckyItem: '작은 노트',
  });
});
