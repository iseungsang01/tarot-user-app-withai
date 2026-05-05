const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const createStorageMock = () => ({ get: async () => null, save: async () => {}, remove: async () => {} });

const createSupabaseModuleMock = (overrides = {}) => ({
  supabase: {
    auth: {
      signInWithPassword: async () => ({ error: null, data: { user: { id: 'user-1' } } }),
      signUp: async () => ({ error: null, data: { user: { id: 'user-1' } } }),
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
    loginCustomer: async () => ({ data: { success: false, reason: 'INVALID_PASSWORD', message: '로그인 실패' }, error: null }),
    getCustomerById: async () => ({ data: null, error: null }),
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
    './supabase': createSupabaseModuleMock({
      supabase: { auth: { signInWithPassword: async () => ({ data: null, error: { message: 'Invalid login credentials' } }) } },
    }),
  });

  const result = await authService.login('01011112222', 'wrong');
  assert.equal(result.error.message, '비밀번호가 일치하지 않습니다.');
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
    loginCustomer: async () => ({ data: { success: false, reason: 'INVALID_PASSWORD', message: '실패' }, error: null }),
    getCustomerById: async () => ({ data: null, error: null }),
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
    './supabase': createSupabaseModuleMock({
      supabase: { auth: { signInWithPassword: async () => ({ data: null, error: { message: 'Invalid login credentials' } }) } },
    }),
  });

  await authService.login('01011112222', 'wrong');
  assert.equal(savedGuard.failedAttempts, 5);
  assert.ok(savedGuard.lockUntil > Date.now());
});

test('authService: 세션 수립 실패 시 원인 분리 에러를 반환한다', async () => {
  const storage = createStorageMock();

  const supabaseClient = {
    loginCustomer: async () => ({
      data: { success: false, message: 'fallback unknown' },
      error: null,
    }),
    getCustomerById: async () => ({ data: { id: 'customer-1', nickname: 'tester' }, error: null }),
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
    './supabase': createSupabaseModuleMock({
      supabase: {
        auth: {
          signInWithPassword: async () => ({ error: { message: 'invalid refresh token', code: '401' }, data: null }),
        },
      },
    }),
  });

  const result = await authService.login('01011112222', 'pw');
  assert.equal(result.data, null);
  assert.equal(result.error.message, 'invalid refresh token');
  assert.equal(result.error.code, 'AUTH_SESSION_FAILED');
});
