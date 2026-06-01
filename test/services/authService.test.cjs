const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const createStorageMock = () => {
  const values = new Map();
  return {
    values,
    get: async (key) => values.get(key) ?? null,
    save: async (key, value) => values.set(key, value),
    remove: async (key) => values.delete(key),
  };
};

test('authService: invalid salt RPC 오류는 계정 비밀번호 저장 형식 문제로 안내한다', async () => {
  const storage = createStorageMock();
  const supabaseClient = {
    loginCustomer: async () => ({
      data: null,
      error: { code: '22023', message: 'invalid salt', details: null, hint: null },
    }),
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
  });

  const result = await authService.login('010-1111-2222', 'pw');

  assert.equal(result.data, null);
  assert.equal(result.error.message, '계정 비밀번호 저장 형식에 문제가 있습니다. 매장에 문의해주세요.');
});

test('authService: 로그인 실패 시 시도 횟수를 증가한다', async () => {
  const storage = createStorageMock();
  const saved = [];
  storage.get = async () => ({ failedAttempts: 1, lockUntil: 0 });
  storage.save = async (...args) => saved.push(args);

  const supabaseClient = {
    loginCustomer: async () => ({ data: { success: false, reason: 'INVALID_PASSWORD', message: '로그인 실패' }, error: null }),
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
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
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
  });

  await authService.login('01011112222', 'wrong');
  assert.equal(savedGuard.failedAttempts, 5);
  assert.ok(savedGuard.lockUntil > Date.now());
});

test('authService: 로그인 성공 시 고객과 RPC 세션 토큰을 저장한다', async () => {
  const storage = createStorageMock();
  const customer = { id: 'customer-1', nickname: 'tester', phone_number: '010-1111-2222' };

  const supabaseClient = {
    loginCustomer: async () => ({
      data: { success: true, session_token: 'session-token', customer },
      error: null,
    }),
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
  });

  const result = await authService.login('010-1111-2222', 'pw');

  assert.deepEqual(result.data, customer);
  assert.deepEqual(await storage.get('tarot_customer'), customer);
  assert.equal((await storage.get('tarot_customer_session')).token, 'session-token');
});

test('authService: 성공 응답에 세션 토큰이 없으면 세션 실패를 반환한다', async () => {
  const storage = createStorageMock();

  const supabaseClient = {
    loginCustomer: async () => ({
      data: { success: true, customer: { id: 'customer-1', nickname: 'tester' } },
      error: null,
    }),
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
  });

  const result = await authService.login('01011112222', 'pw');
  assert.equal(result.data, null);
  assert.equal(result.error.code, 'AUTH_SESSION_FAILED');
});

test('authService: 저장된 세션 토큰으로 회원정보를 복구한다', async () => {
  const storage = createStorageMock();
  await storage.save('tarot_customer_session', { token: 'saved-token', customerId: 'customer-1' });
  const customer = { id: 'customer-1', nickname: 'tester' };

  const supabaseClient = {
    getMyProfile: async ({ p_session_token }) => {
      assert.equal(p_session_token, 'saved-token');
      return { data: { success: true, customer }, error: null };
    },
    logoutCustomer: async () => ({ data: true, error: null }),
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
  });

  const result = await authService.getStoredCustomer();
  assert.deepEqual(result, customer);
  assert.deepEqual(await storage.get('tarot_customer'), customer);
});

test('authService: 회원가입은 Supabase Auth ID 없이 RPC 가입 후 로그인한다', async () => {
  const storage = createStorageMock();
  const calls = [];
  const customer = { id: 'customer-1', nickname: 'tester' };

  const supabaseClient = {
    registerCustomer: async (payload) => {
      calls.push(['register', payload]);
      return { data: { success: true, id: 'customer-1' }, error: null };
    },
    loginCustomer: async (payload) => {
      calls.push(['login', payload]);
      return { data: { success: true, session_token: 'token', customer }, error: null };
    },
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
  });

  const result = await authService.register('010-1111-2222', 'pw', 'tester');

  assert.deepEqual(result.data, customer);
  assert.deepEqual(calls[0], ['register', { p_phone: '010-1111-2222', p_password: 'pw0000', p_nickname: 'tester' }]);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0][1], 'p_id'), false);
  assert.equal(calls[1][0], 'login');
});

test('authService: 회원가입 중 이미 등록된 전화번호는 한국어 안내를 반환한다', async () => {
  const storage = createStorageMock();
  const supabaseClient = {
    registerCustomer: async () => ({
      data: { success: false, message: 'phone number already registered' },
      error: null,
    }),
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
  });

  const result = await authService.register('010-1111-2222', 'password', 'tester');

  assert.equal(result.data, null);
  assert.equal(result.error.message, '이미 가입된 전화번호입니다. 로그인 화면에서 기존 계정으로 로그인해주세요.');
});

test('authService: 로그아웃은 서버 세션 폐기 후 로컬 키를 삭제한다', async () => {
  const storage = createStorageMock();
  await storage.save('tarot_customer_session', { token: 'saved-token', customerId: 'customer-1' });
  await storage.save('tarot_customer', { id: 'customer-1' });
  const revoked = [];

  const supabaseClient = {
    logoutCustomer: async (payload) => {
      revoked.push(payload);
      return { data: true, error: null };
    },
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
  });

  await authService.logout();

  assert.deepEqual(revoked, [{ p_session_token: 'saved-token' }]);
  assert.equal(await storage.get('tarot_customer_session'), null);
  assert.equal(await storage.get('tarot_customer'), null);
});

test('authService: logout clears local session even when remote cleanup fails', async () => {
  const storage = createStorageMock();
  await storage.save('tarot_customer_session', { token: 'saved-token', customerId: 'customer-1' });
  await storage.save('tarot_customer', { id: 'customer-1' });
  await storage.save('auth_login_guard', { failedAttempts: 3, lockUntil: 123 });

  const supabaseClient = {
    logoutCustomer: async () => {
      throw new Error('network down');
    },
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
  });

  await authService.logout();

  assert.equal(await storage.get('tarot_customer_session'), null);
  assert.equal(await storage.get('tarot_customer'), null);
  assert.equal(await storage.get('auth_login_guard'), null);
});


test('authService: logout tolerates Supabase thenables without catch method', async () => {
  const storage = createStorageMock();
  await storage.save('tarot_customer_session', { token: 'saved-token', customerId: 'customer-1' });
  await storage.save('tarot_customer', { id: 'customer-1' });

  const makeThenable = (value) => ({
    then: (resolve) => Promise.resolve(resolve(value)),
  });

  const supabaseClient = {
    logoutCustomer: (payload) => {
      assert.deepEqual(payload, { p_session_token: 'saved-token' });
      return makeThenable({ data: true, error: null });
    },
  };

  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
  });

  await authService.logout();

  assert.equal(await storage.get('tarot_customer_session'), null);
  assert.equal(await storage.get('tarot_customer'), null);
});
