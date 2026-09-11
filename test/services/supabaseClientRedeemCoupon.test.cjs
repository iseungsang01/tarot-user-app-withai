const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const loadClient = (invoke) =>
  loadModule('src/services/supabaseClient.js', {
    './supabase': { supabase: { functions: { invoke } } },
  }).supabaseClient;

test('redeemCoupon: posts the edge function contract and returns its payload', async () => {
  const calls = [];
  const client = loadClient(async (name, options) => {
    calls.push([name, options]);
    return { data: { success: true, message: 'ok' }, error: null };
  });

  const result = await client.redeemCoupon({ couponId: 7, adminPassword: 'pw', sessionToken: 'token' });

  assert.deepEqual(calls, [['redeem-coupon', { body: { couponId: 7, adminPassword: 'pw', sessionToken: 'token' } }]]);
  assert.deepEqual(result, { data: { success: true, message: 'ok' }, error: null });
});

test('redeemCoupon: unwraps the { success, message } body out of a non-2xx response', async () => {
  // supabase-js 는 비-2xx 를 FunctionsHttpError 로 감싸고 본문을 error.context 에 남긴다.
  const body = { success: false, message: 'invalid_admin_password' };
  const client = loadClient(async () => ({
    data: null,
    error: { name: 'FunctionsHttpError', context: { clone: () => ({ json: async () => body }) } },
  }));

  const result = await client.redeemCoupon({ couponId: 7, adminPassword: 'nope', sessionToken: 'token' });

  assert.deepEqual(result, { data: body, error: null });
});

test('redeemCoupon: keeps transport failures as errors', async () => {
  const transportError = new Error('Failed to fetch');
  const client = loadClient(async () => ({ data: null, error: transportError }));

  const result = await client.redeemCoupon({ couponId: 7, adminPassword: 'pw', sessionToken: 'token' });

  assert.equal(result.data, null);
  assert.equal(result.error, transportError);
});
