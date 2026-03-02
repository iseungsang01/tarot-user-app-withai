const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const createStorageMock = () => ({ get: async () => null, save: async () => {}, remove: async () => {} });

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
  });

  await authService.login('01011112222', 'wrong');
  assert.equal(savedGuard.failedAttempts, 5);
  assert.ok(savedGuard.lockUntil > Date.now());
});
