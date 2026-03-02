const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const storage = {
  saveCardImage: async () => {}, saveCardReview: async () => {}, saveCardTitle: async () => {}, saveCardAIInsight: async () => {},
  getCardImage: async () => 'img', getCardReview: async () => 'review', getCardTitle: async () => 'title', getCardAIInsight: async () => 'insight',
  deleteCardImage: async () => {}, deleteCardReview: async () => {}, deleteCardTitle: async () => {}, deleteCardAIInsight: async () => {},
};

test('visitService: CRUD 핵심 시나리오', async () => {
  const calls = { update: null, deleteId: null, saveImage: null };
  const mockedStorage = {
    ...storage,
    saveCardImage: async (...args) => { calls.saveImage = args; },
    deleteCardImage: async (id) => { calls.deleteId = id; },
  };

  const supabaseClient = {
    createVisit: async () => ({ data: { id: 10, customer_id: 'c1', visit_date: '2026-03-01' }, error: null }),
    getVisit: async () => ({ data: { id: 10, customer_id: 'c1', visit_date: '2026-03-01' }, error: null }),
    updateVisit: async (id, payload) => { calls.update = [id, payload]; return { data: { id }, error: null }; },
    softDeleteVisit: async () => ({ error: null }),
  };

  const { visitService } = loadModule('src/services/visitService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: mockedStorage },
  });

  const created = await visitService.createVisit({ customer_id: 'c1', visit_date: '2026-03-01', card_image: 'img' });
  const fetched = await visitService.getVisit(10);
  await visitService.updateVisit(10, { visit_date: '2026-03-02', title: 'new title' });
  const deleted = await visitService.deleteVisit(10);

  assert.equal(created.error, null);
  assert.deepEqual(calls.saveImage, [10, 'img']);
  assert.equal(fetched.data.card_review, 'review');
  assert.deepEqual(calls.update, [10, { visit_date: '2026-03-02' }]);
  assert.equal(deleted.error, null);
  assert.equal(calls.deleteId, 10);
});
