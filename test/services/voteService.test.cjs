const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const createStorageMock = (session = { token: 'session-token', customerId: 'customer-1' }) => ({
  get: async (key) => (key === 'tarot_customer_session' ? session : null),
});

const createSupabaseTableMock = () => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        order: async () => ({ data: [], error: null }),
        single: async () => ({ data: null, error: null }),
      }),
    }),
  }),
});

test('voteService: loads my responses through customer-session RPC', async () => {
  const calls = [];
  const supabaseClient = {
    getMyVoteResponses: async (payload) => {
      calls.push(payload);
      return { data: [{ id: 7, vote_id: 3, selected_options: [1] }], error: null };
    },
  };

  const { voteService } = loadModule('src/services/voteService.js', {
    './supabase': { supabase: createSupabaseTableMock() },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: createStorageMock() },
  });

  const result = await voteService.getMyAllResponses('customer-1');

  assert.deepEqual(calls, [{ p_session_token: 'session-token' }]);
  assert.deepEqual(result.data, { 3: { id: 7, vote_id: 3, selected_options: [1] } });
  assert.equal(result.error, null);
});

test('voteService: submits votes through customer-session RPC without trusting caller customer id', async () => {
  const calls = [];
  const supabaseClient = {
    submitVoteResponse: async (payload) => {
      calls.push(payload);
      return { data: { id: 9, vote_id: 4, customer_id: 'customer-1', selected_options: [2] }, error: null };
    },
  };

  const { voteService } = loadModule('src/services/voteService.js', {
    './supabase': { supabase: createSupabaseTableMock() },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: createStorageMock() },
  });

  const result = await voteService.submitVote(4, 'spoofed-customer-id', [2], null);

  assert.deepEqual(calls, [{
    p_session_token: 'session-token',
    p_vote_id: 4,
    p_selected_options: [2],
    p_response_id: null,
  }]);
  assert.equal(result.data.id, 9);
  assert.equal(result.error, null);
});

test('voteService: reads aggregate vote results through summary RPC', async () => {
  let summaryCalls = 0;
  const supabaseClient = {
    getVoteSummary: async (payload) => {
      summaryCalls += 1;
      assert.deepEqual(payload, { p_vote_id: 5 });
      return { data: { results: { 0: 2, 1: 1 }, count: 3 }, error: null };
    },
  };

  const { voteService } = loadModule('src/services/voteService.js', {
    './supabase': { supabase: createSupabaseTableMock() },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: createStorageMock() },
  });

  assert.deepEqual(await voteService.getVoteSummary(5), { data: { results: { 0: 2, 1: 1 }, count: 3 }, error: null });
  // 결과와 참여자 수는 한 번의 RPC로 함께 얻는다
  assert.equal(summaryCalls, 1);
});
