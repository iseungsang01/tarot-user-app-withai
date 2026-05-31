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
      type: 'customer_rpc_session',
    });
    assert.equal(Object.prototype.hasOwnProperty.call(result.session, 'access_token'), false);
  } finally {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});
