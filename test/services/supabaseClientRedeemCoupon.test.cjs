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

test('redeemCoupon: passes a 2xx failure body straight through', async () => {
  // 함수는 도메인 실패(관리자 비밀번호 오답 등)를 200 + success:false 로 돌려준다.
  // 이 경로에는 감싸기가 없으므로 본문이 그대로 호출부에 닿아야 한다.
  const body = { success: false, message: 'invalid_admin_password' };
  const client = loadClient(async () => ({ data: body, error: null }));

  const result = await client.redeemCoupon({ couponId: 7, adminPassword: 'nope', sessionToken: 'token' });

  assert.deepEqual(result, { data: body, error: null });
});

test('redeemCoupon: unwraps the { success, message } body out of a non-2xx response', async () => {
  // 요청 형식 오류(invalid_request)는 400 으로 온다. supabase-js 가 비-2xx 를
  // FunctionsHttpError 로 감싸고 본문을 error.context 에 남기므로 꺼내야 한다.
  const body = { success: false, message: 'invalid_request' };
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
