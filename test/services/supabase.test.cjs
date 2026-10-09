const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

test('supabase service: disables Supabase Auth persistence and AsyncStorage auth storage', () => {
  const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

  let clientConfig = null;
  try {
    const { getSupabase } = loadModule('src/services/supabase.js', {
      '@react-native-async-storage/async-storage': {
        __esModule: true,
        default: { getItem: async () => null },
      },
      '@supabase/supabase-js': {
        createClient: (_url, _key, config) => {
          clientConfig = config;
          return {};
        },
      },
    });

    getSupabase();

    assert.equal(clientConfig.auth.persistSession, false);
    assert.equal(clientConfig.auth.autoRefreshToken, false);
    assert.equal(clientConfig.auth.detectSessionInUrl, false);
    assert.equal(Object.prototype.hasOwnProperty.call(clientConfig.auth, 'storage'), false);
  } finally {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});

test('supabase service: exposes stored custom customer RPC token explicitly', async () => {
  const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

  try {
    const { ensureAuthenticatedSession } = loadModule('src/services/supabase.js', {
      '@react-native-async-storage/async-storage': {
        __esModule: true,
        default: {
          getItem: async (key) => {
            assert.equal(key, 'tarot_customer_session');
            return JSON.stringify({ token: 'custom-rpc-token', customerId: 'customer-1' });
          },
        },
      },
      '@supabase/supabase-js': { createClient: () => ({}) },
    });

    const result = await ensureAuthenticatedSession();

    assert.equal(result.ok, true);
    assert.deepEqual(result.session, {
      token: 'custom-rpc-token',
      customerId: 'customer-1',
      type: 'customer',
    });
    assert.equal(Object.prototype.hasOwnProperty.call(result.session, 'access_token'), false);
  } finally {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});

test('supabase service: exposes stored AI guest session token explicitly', async () => {
  const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

  try {
    const { ensureAuthenticatedSession } = loadModule('src/services/supabase.js', {
      '@react-native-async-storage/async-storage': {
        __esModule: true,
        default: {
          getItem: async (key) => {
            assert.equal(key, 'tarot_customer_session');
            return JSON.stringify({ token: 'guest-token', customerId: 'guest', type: 'guest' });
          },
        },
      },
      '@supabase/supabase-js': { createClient: () => ({}) },
    });

    const result = await ensureAuthenticatedSession();

    assert.equal(result.ok, true);
    assert.deepEqual(result.session, {
      token: 'guest-token',
      customerId: 'guest',
      type: 'guest',
    });
  } finally {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});

const loadWithHandler = () => {
  const handled = [];
  const mod = loadModule('src/services/supabase.js', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async () => null } },
    '@supabase/supabase-js': { createClient: () => ({}) },
  });
  mod.setGlobalAuthErrorHandler((error) => handled.push(error));
  return { ...mod, handled };
};

test('withAuthErrorHandling: INVALID_SESSION 만 전역 로그아웃으로 넘긴다', () => {
  const { withAuthErrorHandling, handled } = loadWithHandler();

  const rpcError = withAuthErrorHandling({ code: '28000', message: 'INVALID_SESSION' });
  const edgeError = withAuthErrorHandling({ code: 'INVALID_SESSION', reason: 'INVALID_SESSION', message: 'x' });
  const other = { code: '28P01', message: 'INVALID_CREDENTIALS' };

  assert.equal(rpcError.requiresReLogin, true);
  assert.equal(edgeError.requiresReLogin, true);
  assert.equal(withAuthErrorHandling(other), other);
  assert.deepEqual(handled.map((e) => e.reason), ['INVALID_SESSION', 'INVALID_SESSION']);
  // 서버 reason 코드는 화면 문구로 쓰지 않는다
  assert.equal(rpcError.message, '로그인이 만료되었습니다. 다시 로그인해주세요.');
});

test('withAuthErrorHandling: PASSWORD_CHANGE_REQUIRED 는 로그아웃이 아닌 강제 변경으로 넘긴다', () => {
  const { withAuthErrorHandling, handled } = loadWithHandler();

  const error = withAuthErrorHandling({ code: '28000', message: 'PASSWORD_CHANGE_REQUIRED' });

  assert.equal(error.requiresReLogin, false);
  assert.equal(error.isAuthError, true);
  assert.deepEqual(handled.map((e) => e.reason), ['PASSWORD_CHANGE_REQUIRED']);
});
