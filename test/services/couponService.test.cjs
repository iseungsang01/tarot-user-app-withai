const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const createStorageMock = (session = { token: 'session-token', customerId: 'customer-1' }) => ({
  get: async (key) => (key === 'tarot_customer_session' ? session : null),
});

const createSupabaseTableMock = () => ({
  from: () => ({
    insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
    delete: () => ({ lt: () => ({ eq: async () => ({ error: null }) }) }),
  }),
});

test('couponService: loads coupons through customer-session RPC', async () => {
  const calls = [];
  const coupons = [{ id: 1, customer_id: 'customer-1', coupon_code: 'STAMP-1' }];
  const supabaseClient = {
    getMyCoupons: async (payload) => {
      calls.push(payload);
      return { data: coupons, error: null };
    },
  };

  const { couponService } = loadModule('src/services/couponService.js', {
    './supabase': { supabase: createSupabaseTableMock() },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: createStorageMock() },
  });

  const result = await couponService.getCoupons('customer-1');

  assert.deepEqual(calls, [{ p_session_token: 'session-token', p_valid_only: false }]);
  assert.deepEqual(result, { data: coupons, error: null });
});

test('couponService: uses coupons through the redeem-coupon edge function', async () => {
  const calls = [];
  const supabaseClient = {
    redeemCoupon: async (payload) => {
      calls.push(payload);
      return { error: null };
    },
  };

  const { couponService } = loadModule('src/services/couponService.js', {
    './supabase': { supabase: createSupabaseTableMock() },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: createStorageMock() },
  });

  const result = await couponService.useCoupon(10, 'admin-secret');

  assert.deepEqual(calls, [{ couponId: 10, adminPassword: 'admin-secret', sessionToken: 'session-token' }]);
  assert.deepEqual(result, { error: null });
});

test('couponService: rejects coupon use without admin password before calling the edge function', async () => {
  const calls = [];
  const supabaseClient = {
    redeemCoupon: async (payload) => {
      calls.push(payload);
      return { error: null };
    },
  };

  const { couponService } = loadModule('src/services/couponService.js', {
    './supabase': { supabase: createSupabaseTableMock() },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: createStorageMock() },
  });

  const result = await couponService.useCoupon(10, '');

  assert.equal(calls.length, 0);
  assert.equal(result.error.code, 'ADMIN_PASSWORD_REQUIRED');
});

test('couponService: treats invalid admin password as user input without console error logging', async () => {
  const originalConsoleError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);

  try {
    const supabaseClient = {
      redeemCoupon: async () => ({
        error: Object.assign(new Error('INVALID_CREDENTIALS'), { code: 'INVALID_CREDENTIALS', reason: 'INVALID_CREDENTIALS' }),
      }),
    };

    const { couponService } = loadModule('src/services/couponService.js', {
      './supabase': { supabase: createSupabaseTableMock() },
      './supabaseClient': { supabaseClient },
      '../utils/storage': { storage: createStorageMock() },
    });

    const result = await couponService.useCoupon(10, 'wrong-password');

    assert.equal(result.error.reason, 'INVALID_CREDENTIALS');
    assert.equal(errors.length, 0);
  } finally {
    console.error = originalConsoleError;
  }
});
