const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const createStorageMock = () => ({ get: async () => null, save: async () => {}, remove: async () => {} });

const createSupabaseModuleMock = (overrides = {}) => ({
  supabase: {
    auth: {
      setSession: async () => ({ error: null }),
      signInWithPassword: async () => ({ error: null }),
      getSession: async () => ({ data: { session: { access_token: 'token' } }, error: null }),
      signOut: async () => ({ error: null }),
      ...(overrides.supabase?.auth || {}),
    },
  },
  ensureAuthenticatedSession: async () => ({ ok: true, session: { access_token: 'token' }, error: null }),
  normalizeAuthError: (error, fallbackMessage) => ({
    message: error?.message || fallbackMessage,
    code: error?.code || 'AUTH_REQUIRED',
    requiresReLogin: true,
  }),
  ...overrides,
});

test('authService: 로그인 실패 시 시도 횟수를 증가한다', async () => {
  const storage = createStorageMock();
  const saved = [];
  storage.get = async () => ({ failedAttempts: 1, lockUntil: 0 });
  storage.save = async (...args) => saved.push(args);

  const supabaseClient = {
    loginCustomer: async () => ({ data: { success: false, message: '로그인 실패' }, error: null }),
    getCustomerById: async () => ({ data: null, error: null }),
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
    './supabase': createSupabaseModuleMock(),
  });

  const result = await authService.login('01011112222', 'wrong');
  assert.equal(result.error.message, '로그인 실패');
  assert.deepEqual(saved[0], ['auth_login_guard', { failedAttempts: 2, lockUntil: 0 }]);
});

test('authService: 5회 실패 시 클라이언트 잠금 시간을 저장한다', async () => {
  const storage = createStorageMock();
  let savedGuard = null;
  storage.get = async () => ({ failedAttempts: 4, lockUntil: 0 });
  storage.save = async (_, guard) => {
    savedGuard = guard;
  };

  const supabaseClient = {
    loginCustomer: async () => ({ data: { success: false, message: '실패' }, error: null }),
    getCustomerById: async () => ({ data: null, error: null }),
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
    './supabase': createSupabaseModuleMock(),
  });

  await authService.login('01011112222', 'wrong');
  assert.equal(savedGuard.failedAttempts, 5);
  assert.ok(savedGuard.lockUntil > Date.now());
});

test('authService: 세션 수립 실패 시 로그인 성공 응답이어도 에러를 반환한다', async () => {
  const storage = createStorageMock();

  const supabaseClient = {
    loginCustomer: async () => ({
      data: {
        success: true,
        id: 'customer-1',
        auth_email: 'user@example.com',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      },
      error: null,
    }),
    getCustomerById: async () => ({
      data: { id: 'customer-1', nickname: 'tester' },
      error: null,
    }),
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
    './supabase': createSupabaseModuleMock({
      supabase: {
        auth: {
          setSession: async () => ({ error: { message: 'invalid refresh token', code: '401' } }),
          signInWithPassword: async () => ({ error: { message: 'unused fallback' } }),
          getSession: async () => ({ data: { session: null }, error: null }),
        },
      },
      ensureAuthenticatedSession: async () => ({ ok: false, error: { message: '인증이 만료되었습니다. 다시 로그인해주세요.' } }),
    }),
  });

  const result = await authService.login('01011112222', 'pw');
  assert.equal(result.data, null);
  assert.equal(result.error.message, 'invalid refresh token');
  assert.equal(result.error.requiresReLogin, true);
});
