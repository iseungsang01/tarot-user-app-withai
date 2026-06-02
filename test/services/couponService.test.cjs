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

test('couponService: counts valid coupons through customer-session RPC', async () => {
  const calls = [];
  const supabaseClient = {
    getMyCouponCount: async (payload) => {
      calls.push(payload);
      return { data: 3, error: null };
    },
  };

  const { couponService } = loadModule('src/services/couponService.js', {
    './supabase': { supabase: createSupabaseTableMock() },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: createStorageMock() },
  });

  const result = await couponService.getValidCouponCount('customer-1');

  assert.deepEqual(calls, [{ p_session_token: 'session-token', p_valid_only: true }]);
  assert.deepEqual(result, { count: 3, error: null });
});

test('couponService: uses coupons through customer-session and admin-password RPC', async () => {
  const calls = [];
  const supabaseClient = {
    redeemCoupon: async (payload) => {
      calls.push(payload);
      return { data: [{ success: true, message: 'ok' }], error: null };
    },
  };

  const { couponService } = loadModule('src/services/couponService.js', {
    './supabase': { supabase: createSupabaseTableMock() },
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage: createStorageMock() },
  });

  const result = await couponService.useCoupon(10, 'admin-secret');

  assert.deepEqual(calls, [{ p_coupon_id: 10, p_admin_password: 'admin-secret', p_session_token: 'session-token' }]);
  assert.deepEqual(result, { error: null, message: 'ok' });
});

test('couponService: rejects coupon use without admin password before RPC', async () => {
  const calls = [];
  const supabaseClient = {
    redeemCoupon: async (payload) => {
      calls.push(payload);
      return { data: [{ success: true, message: 'ok' }], error: null };
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
        data: [{ success: false, message: 'invalid_admin_password' }],
        error: null,
      }),
    };

    const { couponService } = loadModule('src/services/couponService.js', {
      './supabase': { supabase: createSupabaseTableMock() },
      './supabaseClient': { supabaseClient },
      '../utils/storage': { storage: createStorageMock() },
    });

    const result = await couponService.useCoupon(10, 'wrong-password');

    assert.equal(result.error.code, 'invalid_admin_password');
    assert.equal(errors.length, 0);
  } finally {
    console.error = originalConsoleError;
  }
});
