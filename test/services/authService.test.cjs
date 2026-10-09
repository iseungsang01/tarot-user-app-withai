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

const loadAuthService = (supabaseClient, storage = createStorageMock()) => {
  const { authService } = loadModule('src/services/authService.js', {
    './supabaseClient': { supabaseClient },
    '../utils/storage': { storage },
  });
  return { authService, storage };
};

const CUSTOMER = { id: 'customer-1', nickname: '타로', phone_number: '010-1111-2222', current_stamps: 3, must_change_password: false };
const SESSION_RESPONSE = { session_token: 'session-token', expires_at: '2026-11-01T00:00:00Z', customer: CUSTOMER };

test('authService: 로그인 성공 시 고객과 세션 토큰을 저장한다', async () => {
  const calls = [];
  const { authService, storage } = loadAuthService({
    loginCustomer: async (payload) => { calls.push(payload); return { data: SESSION_RESPONSE, error: null }; },
  });

  const result = await authService.login(' 010-1111-2222 ', 'pw');

  assert.deepEqual(result, { data: CUSTOMER, error: null });
  assert.equal(calls[0].p_phone, '010-1111-2222');
  // 로그인 기기 식별값은 설치마다 만든 무작위 값이다(전화번호·타임존이 아니다)
  assert.match(calls[0].p_client_fingerprint, /^[0-9a-f]{32}$/);
  assert.equal((await storage.get('tarot_customer_session')).token, 'session-token');
  assert.equal((await storage.get('tarot_customer_session')).type, 'customer');
  assert.deepEqual(await storage.get('tarot_customer'), CUSTOMER);
});

test('authService: 28P01 은 가입 여부가 드러나지 않는 단일 문구로 안내한다', async () => {
  const { authService, storage } = loadAuthService({
    loginCustomer: async () => ({ data: null, error: { code: '28P01', message: 'INVALID_CREDENTIALS' } }),
  });

  const result = await authService.login('010-1111-2222', 'wrong');

  assert.equal(result.data, null);
  assert.equal(result.error.message, '전화번호 또는 비밀번호가 일치하지 않습니다.');
  assert.equal(await storage.get('tarot_customer_session'), null);
});

test('authService: 잠금(P0001)은 DETAIL 의 남은 초로 재시도 시점을 알린다', async () => {
  const { authService } = loadAuthService({
    loginCustomer: async () => ({ data: null, error: { code: 'P0001', message: 'RATE_LIMITED', details: '300' } }),
  });

  const result = await authService.login('010-1111-2222', 'pw');

  assert.equal(result.error.message, '로그인 시도가 너무 많습니다. 5분 후 다시 시도해주세요.');
});

test('authService: 성공 응답에 세션 토큰이 없으면 세션 실패를 반환한다', async () => {
  const { authService } = loadAuthService({
    loginCustomer: async () => ({ data: { customer: CUSTOMER }, error: null }),
  });

  const result = await authService.login('010-1111-2222', 'pw');

  assert.equal(result.data, null);
  assert.equal(result.error.code, 'AUTH_SESSION_FAILED');
});

test('authService: 가입은 login 을 다시 부르지 않고 가입 응답의 세션을 저장한다', async () => {
  const calls = [];
  const { authService, storage } = loadAuthService({
    registerCustomer: async (payload) => { calls.push(payload); return { data: SESSION_RESPONSE, error: null }; },
    loginCustomer: async () => { throw new Error('should not call login'); },
  });

  const result = await authService.register('010-1111-2222', 'password1', '타로');

  const [{ p_client_fingerprint: fingerprint, ...rest }] = calls;
  assert.deepEqual(rest, { p_phone: '010-1111-2222', p_password: 'password1', p_nickname: '타로' });
  assert.match(fingerprint, /^[0-9a-f]{32}$/);
  assert.deepEqual(result, { data: CUSTOMER, error: null });
  assert.equal((await storage.get('tarot_customer_session')).token, 'session-token');
});

test('authService: 가입 실패 문구는 SQLSTATE 와 reason 으로 고른다', async () => {
  const cases = [
    [{ code: '23505', message: 'PHONE_TAKEN' }, '이미 가입된 전화번호입니다. 로그인 화면에서 기존 계정으로 로그인해주세요.'],
    [{ code: '22023', message: 'WEAK_PASSWORD' }, '비밀번호는 6자 이상이어야 하고 123456 은 쓸 수 없습니다.'],
    [{ code: '22023', message: 'INVALID_INPUT' }, '입력한 정보를 다시 확인해주세요.'],
    [{ code: 'P0001', message: 'RATE_LIMITED', details: '3600' }, '가입 시도가 너무 많습니다. 60분 후 다시 시도해주세요.'],
  ];

  for (const [error, expected] of cases) {
    const { authService } = loadAuthService({ registerCustomer: async () => ({ data: null, error }) });
    const result = await authService.register('010-1111-2222', 'password1', '타로');
    assert.equal(result.error.message, expected, error.message);
  }
});

test('authService: 게스트 세션은 type guest 로 저장하고 게스트 객체는 앱이 만든다', async () => {
  const { authService, storage } = loadAuthService({
    issueGuestSession: async () => ({ data: { session_token: 'guest-token', expires_at: '2026-10-10T00:00:00Z' }, error: null }),
  });

  const result = await authService.guestLogin();

  assert.equal(result.data.isGuest, true);
  assert.equal(result.data.id, 'guest');
  assert.deepEqual(
    { token: (await storage.get('tarot_customer_session')).token, type: (await storage.get('tarot_customer_session')).type },
    { token: 'guest-token', type: 'guest' },
  );
});

test('authService: 게스트 발급 한도(P0001)는 재시도 안내를 반환한다', async () => {
  const { authService } = loadAuthService({
    issueGuestSession: async () => ({ data: null, error: { code: 'P0001', message: 'RATE_LIMITED', details: '30' } }),
  });

  const result = await authService.guestLogin();

  assert.equal(result.data, null);
  assert.equal(result.error.message, '게스트 접속이 너무 많습니다. 30초 후 다시 시도해주세요.');
});

test('authService: 저장된 세션 토큰으로 회원정보를 복구한다', async () => {
  const storage = createStorageMock();
  await storage.save('tarot_customer_session', { token: 'saved-token', customerId: 'customer-1', type: 'customer' });
  const calls = [];
  const { authService } = loadAuthService({
    getMyProfile: async (payload) => { calls.push(payload); return { data: CUSTOMER, error: null }; },
  }, storage);

  const result = await authService.getStoredCustomer();

  assert.deepEqual(calls, [{ p_session_token: 'saved-token' }]);
  assert.deepEqual(result, CUSTOMER);
});

test('authService: 복구 중 INVALID_SESSION 이면 세션을 지운다', async () => {
  const storage = createStorageMock();
  await storage.save('tarot_customer_session', { token: 'saved-token', customerId: 'customer-1', type: 'customer' });
  await storage.save('tarot_customer', CUSTOMER);
  const { authService } = loadAuthService({
    getMyProfile: async () => ({ data: null, error: { code: '28000', message: 'INVALID_SESSION', reason: 'INVALID_SESSION' } }),
    logout: async () => ({ data: null, error: null }),
  }, storage);

  assert.equal(await authService.getStoredCustomer(), null);
  assert.equal(await storage.get('tarot_customer_session'), null);
  assert.equal(await storage.get('tarot_customer'), null);
});

test('authService: 복구 중 네트워크 오류는 로그아웃하지 않고 저장된 고객으로 계속한다', async () => {
  const storage = createStorageMock();
  await storage.save('tarot_customer_session', { token: 'saved-token', customerId: 'customer-1', type: 'customer' });
  await storage.save('tarot_customer', CUSTOMER);
  const { authService } = loadAuthService({
    getMyProfile: async () => ({ data: null, error: { message: 'Failed to fetch' } }),
  }, storage);

  assert.deepEqual(await authService.getStoredCustomer(), CUSTOMER);
  assert.equal((await storage.get('tarot_customer_session')).token, 'saved-token');
});

test('authService: 게스트 세션 복구는 프로필 RPC 를 부르지 않는다', async () => {
  const storage = createStorageMock();
  await storage.save('tarot_customer_session', { token: 'guest-token', customerId: 'guest', type: 'guest' });
  const { authService } = loadAuthService({
    getMyProfile: async () => { throw new Error('should not call'); },
  }, storage);

  const result = await authService.getStoredCustomer();

  assert.equal(result.isGuest, true);
});

test('authService: 로그아웃은 고객·게스트 공용 logout 으로 토큰을 폐기하고 로컬 키를 지운다', async () => {
  for (const type of ['customer', 'guest']) {
    const storage = createStorageMock();
    await storage.save('tarot_customer_session', { token: `${type}-token`, customerId: 'x', type });
    await storage.save('tarot_customer', { id: 'x' });
    const revoked = [];
    const { authService } = loadAuthService({
      logout: async (payload) => { revoked.push(payload); return { data: null, error: null }; },
    }, storage);

    await authService.logout();

    assert.deepEqual(revoked, [{ p_session_token: `${type}-token` }]);
    assert.equal(await storage.get('tarot_customer_session'), null);
    assert.equal(await storage.get('tarot_customer'), null);
  }
});

test('authService: 서버 logout 이 실패해도 로컬 세션은 지운다', async () => {
  const storage = createStorageMock();
  await storage.save('tarot_customer_session', { token: 'saved-token', customerId: 'customer-1', type: 'customer' });
  await storage.save('tarot_customer', CUSTOMER);
  const { authService } = loadAuthService({
    logout: async () => { throw new Error('network down'); },
  }, storage);

  await authService.logout();

  assert.equal(await storage.get('tarot_customer_session'), null);
  assert.equal(await storage.get('tarot_customer'), null);
});
