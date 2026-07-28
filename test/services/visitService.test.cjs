const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const storage = {
  saveCardImage: async () => {}, saveCardReview: async () => {}, saveCardTitle: async () => {}, saveCardAIInsight: async () => {},
  getCardImage: async () => 'img', getCardReview: async () => 'review', getCardTitle: async () => 'title', getCardAIInsight: async () => 'insight',
  deleteCardImage: async () => {}, deleteCardReview: async () => {}, deleteCardTitle: async () => {}, deleteCardAIInsight: async () => {},
};

test('visitService: CRUD ?듭떖 ?쒕굹由ъ삤', async () => {
  const calls = { update: null, deleteId: null, saveImage: null, hide: null, getMyVisit: null };
  const mockedStorage = {
    ...storage,
    saveCardImage: async (...args) => { calls.saveImage = args; },
    deleteCardImage: async (id) => { calls.deleteId = id; },
  };

  const supabaseClient = {
    getMyVisit: async (payload) => {
      calls.getMyVisit = payload;
      return { data: { id: 10, customer_id: 'c1', visit_date: '2026-03-01' }, error: null };
    },
    hideMyVisit: async (payload) => { calls.hide = payload; return { data: true, error: null }; },
  };

  const { visitService } = loadModule('src/services/visitService.js', {
    './supabase': {
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'test-token' }, error: null }),
      withAuthErrorHandling: (error) => error,
      supabase: {},
    },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: mockedStorage },
  });

  const fetched = await visitService.getVisit(10);
  // visit_date 는 서버 쓰기 경로가 없으므로 무시되고, title 만 로컬에 저장된다.
  await visitService.updateVisit(10, { visit_date: '2026-03-02', title: 'new title', card_image: 'img' });
  const deleted = await visitService.deleteVisit(10, 'c1');

  assert.deepEqual(calls.saveImage, [10, 'img']);
  assert.deepEqual(calls.getMyVisit, { p_session_token: 'test-token', p_visit_id: 10 });
  assert.equal(fetched.data.card_review, 'review');
  assert.equal(deleted.error, null);
  assert.deepEqual(calls.hide, { p_session_token: 'test-token', p_visit_id: 10 });
  assert.equal(calls.deleteId, 10);
});

test('visitService: visit list uses the stored RPC session token', async () => {
  const calls = [];
  const supabaseClient = {
    getMyVisits: async (payload) => {
      calls.push(payload);
      return { data: [{ id: 10, customer_id: 'c1', visit_date: '2026-03-01' }], error: null };
    },
  };

  const { visitService } = loadModule('src/services/visitService.js', {
    './supabase': {
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'rpc-token' }, error: null }),
      withAuthErrorHandling: (error) => error,
      supabase: {},
    },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
  });

  const result = await visitService.getVisits('customer-1');

  assert.deepEqual(calls, [{ p_session_token: 'rpc-token' }]);
  assert.deepEqual(result, { data: [{ id: 10, customer_id: 'c1', visit_date: '2026-03-01' }], error: null });
});

test('visitService: customer stats use the stored RPC session token', async () => {
  const calls = [];
  const supabaseClient = {
    getCustomerStats: async (payload) => {
      calls.push(payload);
      return { data: { success: true, current_stamps: 4, visit_count: 9 }, error: null };
    },
  };

  const { visitService } = loadModule('src/services/visitService.js', {
    './supabase': {
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'rpc-token' }, error: null }),
      withAuthErrorHandling: (error) => error,
      supabase: {},
    },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
  });

  const result = await visitService.getCustomerStats('customer-1');

  assert.deepEqual(calls, [{ p_session_token: 'rpc-token' }]);
  assert.deepEqual(result, { data: { current_stamps: 4, visit_count: 9 }, error: null });
});



test('visitService: updateVisit keeps local-only fields bound to storage object and off server payload', async () => {
  const calls = [];
  const mockedStorage = {
    saveCardImage(id, value) { assert.equal(this, mockedStorage); calls.push(['saveCardImage', id, value]); },
    deleteCardImage(id) { assert.equal(this, mockedStorage); calls.push(['deleteCardImage', id]); },
    saveCardReview(id, value) { assert.equal(this, mockedStorage); calls.push(['saveCardReview', id, value]); },
    deleteCardReview(id) { assert.equal(this, mockedStorage); calls.push(['deleteCardReview', id]); },
    saveCardTitle(id, value) { assert.equal(this, mockedStorage); calls.push(['saveCardTitle', id, value]); },
    deleteCardTitle(id) { assert.equal(this, mockedStorage); calls.push(['deleteCardTitle', id]); },
    saveCardAIInsight(id, value) { assert.equal(this, mockedStorage); calls.push(['saveCardAIInsight', id, value]); },
    deleteCardAIInsight(id) { assert.equal(this, mockedStorage); calls.push(['deleteCardAIInsight', id]); },
  };
  // visit_history 서버 쓰기 경로는 제거됐다. supabaseClient 에 쓰기 메서드가
  // 남아 있으면 안 되므로, 어떤 메서드든 호출되면 즉시 실패하도록 둔다.
  const supabaseClient = new Proxy({}, {
    get(_target, prop) {
      throw new Error(`updateVisit 가 supabaseClient.${String(prop)} 를 호출하면 안 된다`);
    },
  });

  const { visitService } = loadModule('src/services/visitService.js', {
    './supabase': {
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'rpc-token' }, error: null }),
      withAuthErrorHandling: (error) => error,
      supabase: {},
    },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: mockedStorage },
  });

  await visitService.updateVisit(44, {
    card_image: 'image-data',
    card_review: '',
    title: 'title',
    ai_insight: null,
    visit_date: '2026-06-06',
  });

  assert.deepEqual(calls, [
    ['saveCardImage', 44, 'image-data'],
    ['deleteCardReview', 44],
    ['saveCardTitle', 44, 'title'],
    ['deleteCardAIInsight', 44],
  ]);
});
