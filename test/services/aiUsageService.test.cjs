const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

test('aiUsageService: blocks when monthly count reaches configured limit', async () => {
  const { ensureAIUsageAllowed } = loadModule('src/services/aiUsageService.js', {
    '../constants/Config': { AI_USAGE_LIMITS: { monthly: { summarize_review: 1 } } },
    './supabase': {
      ensureAuthenticatedSession: async () => ({ ok: true, session: { access_token: 'token' } }),
      withAuthErrorHandling: (error) => error,
    },
    './supabaseClient': {
      supabaseClient: {
        getMyAIUsage: async () => ({ data: [{ usage_type: 'summarize_review', usage_count: 1 }], error: null }),
      },
    },
  });

  const result = await ensureAIUsageAllowed('summarize_review', '2026-05-01');

  assert.equal(result.allowed, false);
  assert.equal(result.error.code, 'AI_MONTHLY_LIMIT_EXCEEDED');
});

test('aiUsageService: increments through session-token RPC', async () => {
  let payload;
  const { incrementMyAIUsage } = loadModule('src/services/aiUsageService.js', {
    '../constants/Config': { AI_USAGE_LIMITS: { monthly: {} } },
    './supabase': {
      ensureAuthenticatedSession: async () => ({ ok: true, session: { access_token: 'token' } }),
      withAuthErrorHandling: (error) => error,
    },
    './supabaseClient': {
      supabaseClient: {
        incrementMyAIUsage: async (input) => {
          payload = input;
          return { data: { usage_type: input.p_usage_type, usage_count: 2 }, error: null };
        },
      },
    },
  });

  const result = await incrementMyAIUsage('daily_fortune_redraw', 1, '2026-05-01');

  assert.equal(result.error, null);
  assert.equal(payload.p_session_token, 'token');
  assert.equal(payload.p_usage_type, 'daily_fortune_redraw');
  assert.equal(payload.p_month_bucket, '2026-05-01');
});
