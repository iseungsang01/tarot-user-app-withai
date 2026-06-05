const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const storage = {
  saveCardImage: async () => {}, saveCardReview: async () => {}, saveCardTitle: async () => {}, saveCardAIInsight: async () => {},
  getCardImage: async () => 'img', getCardReview: async () => 'review', getCardTitle: async () => 'title', getCardAIInsight: async () => 'insight',
  deleteCardImage: async () => {}, deleteCardReview: async () => {}, deleteCardTitle: async () => {}, deleteCardAIInsight: async () => {},
};

test('visitService: CRUD ?듭떖 ?쒕굹由ъ삤', async () => {
  const calls = { update: null, deleteId: null, saveImage: null, hide: null };
  const mockedStorage = {
    ...storage,
    saveCardImage: async (...args) => { calls.saveImage = args; },
    deleteCardImage: async (id) => { calls.deleteId = id; },
  };

  const supabaseClient = {
    createVisit: async () => ({ data: { id: 10, customer_id: 'c1', visit_date: '2026-03-01' }, error: null }),
    getVisit: async () => ({ data: { id: 10, customer_id: 'c1', visit_date: '2026-03-01' }, error: null }),
    updateVisit: async (id, payload) => { calls.update = [id, payload]; return { data: { id }, error: null }; },
    hideVisitFromCustomer: async (...args) => { calls.hide = args; return { data: true, error: null }; },
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

  const created = await visitService.createVisit({ customer_id: 'c1', visit_date: '2026-03-01', card_image: 'img' });
  const fetched = await visitService.getVisit(10);
  await visitService.updateVisit(10, { visit_date: '2026-03-02', title: 'new title' });
  const deleted = await visitService.deleteVisit(10, 'c1');

  assert.equal(created.error, null);
  assert.deepEqual(calls.saveImage, [10, 'img']);
  assert.equal(fetched.data.card_review, 'review');
  assert.deepEqual(calls.update, [10, { visit_date: '2026-03-02' }]);
  assert.equal(deleted.error, null);
  assert.deepEqual(calls.hide, [10, 'c1']);
  assert.equal(calls.deleteId, 10);
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

