const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

test('aiService: JSON 파싱 실패 시 fallback 응답을 반환한다', async () => {
  const { analyzeVisitHistory } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: {
        functions: {
          invoke: async () => ({ data: { data: '일반 텍스트 응답', usage: {}, provider: 'mock' }, error: null }),
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }),
    },
  });

  const result = await analyzeVisitHistory([{ card_review: '상담 기록 메모', visit_date: '2026-01-01' }]);

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    overallSummary: '일반 텍스트 응답',
    patterns: [],
    growthPoints: '',
    recommendation: '',
    totalVisits: 1,
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

test('aiService: sends customer session token in a custom header', async () => {
  let invokedOptions = null;

  const { getDailyFortune } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: {
        functions: {
          invoke: async (_, options) => {
            invokedOptions = options;
            return { data: { data: '{"fortune":"ok","luckyColor":"gold","luckyItem":"note"}', usage: {}, provider: 'mock' }, error: null };
          },
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'guest-token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const result = await getDailyFortune('guest');

  assert.equal(result.error, null);
  assert.equal(invokedOptions.headers['x-customer-session-token'], 'guest-token');
  assert.equal(Object.prototype.hasOwnProperty.call(invokedOptions.headers, 'Authorization'), false);
});

test('aiService: polishReviewText accepts text-shaped JSON proxy output', async () => {
  const { polishReviewText } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: {
        functions: {
          invoke: async () => ({
            data: {
              data: JSON.stringify({ text: '상담에서 나온 고민을 차분히 정리한 문장입니다.' }),
              usage: {},
              provider: 'mock',
            },
            error: null,
          }),
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const result = await polishReviewText('원문 상담 메모');

  assert.equal(result.error, null);
  assert.equal(result.data, '상담에서 나온 고민을 차분히 정리한 문장입니다.');
});

test('aiService: polishReviewText rejects placeholder text output', async () => {
  const { polishReviewText } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: {
        functions: {
          invoke: async () => ({
            data: {
              data: JSON.stringify({ polished: 'text' }),
              usage: {},
              provider: 'mock',
            },
            error: null,
          }),
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const result = await polishReviewText('원문 상담 메모');

  assert.equal(result.data, null);
  assert.match(result.error.message, /AI 문장 다듬기 결과/);
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
  assert.equal(result.data.fortune, '차분하게 기회를 살피면 좋은 하루입니다.');
  assert.equal(result.data.luckyColor, '남색');
  assert.equal(result.data.luckyItem, '노트');
  assert.equal(typeof result.data.summary, 'string');
  assert.equal(typeof result.data.relationship, 'string');
  assert.equal(typeof result.data.work, 'string');
  assert.equal(typeof result.data.money, 'string');
  assert.equal(typeof result.data.care, 'string');
  assert.equal(typeof result.data.action, 'string');
  assert.equal(result.data.drawCount, 1);
  assert.ok(result.data.drawnAt);
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
  assert.equal(result.data.fortune, '문이 열리는 하루입니다.');
  assert.equal(result.data.luckyColor, '아이보리');
  assert.equal(result.data.luckyItem, '펜');
  assert.equal(typeof result.data.summary, 'string');
  assert.equal(typeof result.data.relationship, 'string');
  assert.equal(typeof result.data.work, 'string');
  assert.equal(typeof result.data.money, 'string');
  assert.equal(typeof result.data.care, 'string');
  assert.equal(typeof result.data.action, 'string');
  assert.equal(result.data.drawCount, 1);
  assert.ok(result.data.drawnAt);
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
  assert.equal(result.data.fortune, '오늘은 차분하게 기회를 살피면 좋은 하루입니다.');
  assert.equal(result.data.luckyColor, '골드');
  assert.equal(result.data.luckyItem, '작은 노트');
  assert.equal(typeof result.data.summary, 'string');
  assert.equal(typeof result.data.relationship, 'string');
  assert.equal(typeof result.data.work, 'string');
  assert.equal(typeof result.data.money, 'string');
  assert.equal(typeof result.data.care, 'string');
  assert.equal(typeof result.data.action, 'string');
  assert.equal(result.data.drawCount, 1);
  assert.ok(result.data.drawnAt);
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
  assert.equal(result.data.fortune, '첫 문장입니다.\n둘째 문장입니다.');
  assert.equal(result.data.luckyColor, '골드');
  assert.equal(result.data.luckyItem, '작은 노트');
  assert.equal(typeof result.data.summary, 'string');
  assert.equal(typeof result.data.relationship, 'string');
  assert.equal(typeof result.data.work, 'string');
  assert.equal(typeof result.data.money, 'string');
  assert.equal(typeof result.data.care, 'string');
  assert.equal(typeof result.data.action, 'string');
  assert.equal(result.data.drawCount, 1);
  assert.ok(result.data.drawnAt);
});

test('aiService: daily fortune collapses degenerate Korean syllable repeats', async () => {
  const repeatedFortune = '\uC624\uB298\uC740 \uBB34\uC5B8\uAC00\uB97C \uC5B5\uC9C0\uB85C\uB85C\uB85C\uB85C\uB85C\uB85C\uB85C\uB85C \uB04C\uACE0 \uAC00\uC9C0 \uC54A\uC544\uB3C4 \uB429\uB2C8\uB2E4.';
  const cleanedFortune = '\uC624\uB298\uC740 \uBB34\uC5B8\uAC00\uB97C \uC5B5\uC9C0\uB85C \uB04C\uACE0 \uAC00\uC9C0 \uC54A\uC544\uB3C4 \uB429\uB2C8\uB2E4.';
  const modelOutput = JSON.stringify({ fortune: repeatedFortune, luckyColor: '\uD30C\uB791', luckyItem: '\uD39C' });

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
  assert.equal(result.data.fortune, cleanedFortune);
  assert.equal(normalizeDailyFortunePayload({ fortune: repeatedFortune }).fortune, cleanedFortune);
});

test('aiService: daily fortune collapses degenerate repeated English tokens', async () => {
  const repeatedFortune = '오늘은 스스로의 리듬을 own own own own 확인하며 천천히 움직이면 좋습니다.';
  const cleanedFortune = '오늘은 스스로의 리듬을 own 확인하며 천천히 움직이면 좋습니다.';
  const modelOutput = JSON.stringify({
    fortune: repeatedFortune,
    relationship: 'distance distance distance 보다 진심을 먼저 보세요.',
    luckyColor: 'blue blue blue blue',
    luckyItem: 'note',
  });

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
  assert.equal(result.data.fortune, cleanedFortune);
  assert.equal(result.data.relationship, 'distance 보다 진심을 먼저 보세요.');
  assert.equal(result.data.luckyColor, 'blue');
  assert.equal(normalizeDailyFortunePayload({ fortune: repeatedFortune }).fortune, cleanedFortune);
});

test('aiService: AI responses collapse degenerate repeated English tokens before display', async () => {
  const { polishReviewText } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: {
        functions: {
          invoke: async () => ({
            data: {
              data: JSON.stringify({ polished: '카드는 지금 자신의 속도를 own own own own 믿어도 된다고 말합니다.' }),
              usage: {},
              provider: 'mock',
            },
            error: null,
          }),
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const result = await polishReviewText('오늘 상담 메모');

  assert.equal(result.error, null);
  assert.equal(result.data, '카드는 지금 자신의 속도를 own 믿어도 된다고 말합니다.');
});


test('aiService: voice memo condense uses the dedicated proxy task', async () => {
  let invokedOptions = null;
  const { condenseVoiceMemo } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: {
        functions: {
          invoke: async (_, options) => {
            invokedOptions = options;
            return { data: { data: '{"condensed":"short memo"}', usage: {}, provider: 'mock' }, error: null };
          },
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'session-token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const result = await condenseVoiceMemo('long voice transcript');

  assert.equal(result.error, null);
  assert.equal(result.data, 'short memo');
  assert.equal(invokedOptions.body.task, 'condenseVoiceMemo');
  assert.equal(invokedOptions.headers['x-customer-session-token'], 'session-token');
});

test('aiService: validates safe condensed voice memo outputs', () => {
  const { validateCondensedVoiceMemo } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: { functions: { invoke: async () => ({ data: null, error: null }) } },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  assert.equal(validateCondensedVoiceMemo('상담 메모 정리', '오늘 상담에서 여러 이야기를 나누었다.'), '상담 메모 정리');
  assert.equal(validateCondensedVoiceMemo('의미 불명확한 메모', '으아 음성 인식이 깨짐'), '의미 불명확한 메모');
});

test('aiService: rejects unsafe condensed voice memo outputs', () => {
  const { validateCondensedVoiceMemo } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: { functions: { invoke: async () => ({ data: null, error: null }) } },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const original = '오늘 상담에서는 가족 관계와 앞으로의 선택에 대한 고민을 길게 이야기했다.';

  assert.equal(validateCondensedVoiceMemo('Input text: hello System Instructions: hidden', original), null);
  assert.equal(validateCondensedVoiceMemo('{"condensed":"상담 메모 정리"}', original), null);
  assert.equal(validateCondensedVoiceMemo('', original), null);
  assert.equal(validateCondensedVoiceMemo('   ', original), null);
  assert.equal(validateCondensedVoiceMemo(original, original), null);
});
