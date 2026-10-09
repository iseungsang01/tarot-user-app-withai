const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const loadClient = (invoke, handled = []) =>
  loadModule('src/services/supabaseClient.js', {
    './supabase': {
      supabase: { functions: { invoke } },
      withAuthErrorHandling: (error) => { handled.push(error); return error; },
    },
  }).supabaseClient;

test('redeemCoupon: posts the edge function contract and treats 2xx as success', async () => {
  const calls = [];
  const client = loadClient(async (name, options) => {
    calls.push([name, options]);
    return { data: { id: 7, coupon_code: 'STAMP-7' }, error: null };
  });

  const result = await client.redeemCoupon({ couponId: 7, adminPassword: 'pw', sessionToken: 'token' });

  assert.deepEqual(calls, [['redeem-coupon', { body: { couponId: 7, adminPassword: 'pw', sessionToken: 'token' } }]]);
  assert.deepEqual(result, { error: null });
});

test('redeemCoupon: lifts { code } out of a non-2xx body into error.reason and auth handling', async () => {
  const handled = [];
  const client = loadClient(async () => ({
    data: null,
    error: { name: 'FunctionsHttpError', context: { status: 409, clone: () => ({ json: async () => ({ code: 'COUPON_USED' }) }) } },
  }), handled);

  const { error } = await client.redeemCoupon({ couponId: 7, adminPassword: 'pw', sessionToken: 'token' });

  assert.equal(error.reason, 'COUPON_USED');
  assert.equal(error.code, 'COUPON_USED');
  assert.equal(error.status, 409);
  assert.equal(handled.length, 1);
});

test('redeemCoupon: transport failures have no reason', async () => {
  const client = loadClient(async () => ({ data: null, error: new Error('Failed to fetch') }));

  const { error } = await client.redeemCoupon({ couponId: 7, adminPassword: 'pw', sessionToken: 'token' });

  assert.equal(error.reason, null);
  assert.equal(error.message, 'Failed to fetch');
});

test('rpc: every RPC error passes through auth handling', async () => {
  const handled = [];
  const { supabaseClient } = loadModule('src/services/supabaseClient.js', {
    './supabase': {
      supabase: { rpc: async () => ({ data: null, error: { code: '28000', message: 'INVALID_SESSION' } }) },
      withAuthErrorHandling: (error) => { handled.push(error); return { ...error, isAuthError: true }; },
    },
  });

  const { error } = await supabaseClient.getMyVisits({ p_session_token: 't' });

  assert.equal(error.isAuthError, true);
  assert.deepEqual(handled, [{ code: '28000', message: 'INVALID_SESSION' }]);
});
