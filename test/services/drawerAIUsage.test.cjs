const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

function loadUsage(initial = {}) {
  const store = { drawer_ai_usage: initial };
  const coreStorage = {
    get: async (key) => store[key] ?? null,
    save: async (key, value) => { store[key] = value; },
  };
  const mod = loadModule('src/utils/storage/drawerAIUsage.js', {
    './core': { coreStorage, STORAGE_KEYS: { DRAWER_AI_USAGE: 'drawer_ai_usage' } },
  });
  return { ...mod, store };
}

test('drawer AI usage initializes monthly counters', async () => {
  const usage = loadUsage();
  assert.deepEqual(await usage.getDrawerAIUsage('2026-06'), { voiceCondense: 0, polishReview: 0, historySummary: 0 });
  assert.equal(await usage.getRemainingDrawerAIUsage('voiceCondense', '2026-06'), 30);
  assert.equal(await usage.getRemainingDrawerAIUsage('polishReview', '2026-06'), 30);
});

test('drawer AI usage separates months and caps at 30', async () => {
  const usage = loadUsage({ '2026-06': { voiceCondense: 29 }, '2026-07': { voiceCondense: 2 } });
  assert.deepEqual(await usage.incrementDrawerAIUsage('voiceCondense', '2026-06'), {
    allowed: true,
    usage: { voiceCondense: 30, polishReview: 0, historySummary: 0 },
    remaining: 0,
  });
  assert.deepEqual(await usage.incrementDrawerAIUsage('voiceCondense', '2026-06'), {
    allowed: false,
    usage: { voiceCondense: 30, polishReview: 0, historySummary: 0 },
    remaining: 0,
  });
  assert.equal(await usage.getRemainingDrawerAIUsage('voiceCondense', '2026-07'), 28);
});
