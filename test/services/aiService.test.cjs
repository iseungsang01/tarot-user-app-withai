const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

test('aiService: JSON 파싱 실패 시 fallback 응답을 반환한다', async () => {
  const supabaseClient = {
    invokeAIProxy: async () => ({ data: { data: '일반 텍스트 응답', usage: {}, provider: 'mock' }, error: null }),
  };

  const { summarizeReview } = loadModule('src/services/aiService.js', {
    './supabaseClient': { supabaseClient },
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
