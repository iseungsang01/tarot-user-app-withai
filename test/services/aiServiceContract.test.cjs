const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

test('aiService: sends only task and structured input, never prompts', async () => {
  let invokedBody = null;
  const { polishReviewText } = loadModule('src/services/aiService.js', {
    './supabase': {
      supabase: {
        functions: {
          invoke: async (_, options) => {
            invokedBody = options.body;
            return { data: { data: '{"polished":"정리된 메모"}' }, error: null };
          },
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'mock_token' } }),
      withAuthErrorHandling: (error) => error,
    },
  });

  const result = await polishReviewText('원본 메모');

  assert.equal(result.error, null);
  assert.deepEqual(invokedBody, { task: 'polishReviewText', input: { text: '원본 메모' } });
});
