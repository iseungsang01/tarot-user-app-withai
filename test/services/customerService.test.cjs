const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

test('customerService: password change uses stored session-token RPC', async () => {
  const calls = [];
  const { customerService } = loadModule('src/services/customerService.js', {
    './supabase': {
      supabase: {},
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'session-token' } }),
      withAuthErrorHandling: (error) => error,
    },
    './supabaseClient': {
      supabaseClient: {
        updateMyPassword: async (payload) => { calls.push(payload); return { data: null, error: null }; },
      },
    },
  });

  const result = await customerService.updateMyPassword('old-pass', 'new-pass', 'settings_change');

  assert.deepEqual(calls, [{
    p_session_token: 'session-token',
    current_password: 'old-pass',
    new_password: 'new-pass',
    p_reason: 'settings_change',
  }]);
  assert.deepEqual(result, { success: true, error: null });
});

test('customerService: account deletion uses session token and input password', async () => {
  const calls = [];
  const { customerService } = loadModule('src/services/customerService.js', {
    './supabase': {
      supabase: {},
      ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 'session-token' } }),
      withAuthErrorHandling: (error) => error,
    },
    './supabaseClient': {
      supabaseClient: {
        deleteMyAccount: async (payload) => { calls.push(payload); return { data: null, error: null }; },
      },
    },
  });

  const result = await customerService.deleteCustomer('password');

  assert.deepEqual(calls, [{ p_session_token: 'session-token', input_password: 'password' }]);
  assert.deepEqual(result, { success: true, error: null });
});

test('customerService: missing session returns re-login style error without RPC', async () => {
  const { customerService } = loadModule('src/services/customerService.js', {
    './supabase': {
      supabase: {},
      ensureAuthenticatedSession: async () => ({ ok: false, error: new Error('session missing') }),
      withAuthErrorHandling: (error, fallback) => ({ message: fallback, original: error }),
    },
    './supabaseClient': {
      supabaseClient: {
        updateMyPassword: async () => { throw new Error('should not call'); },
      },
    },
  });

  const result = await customerService.updateMyPassword('old', 'new');
  assert.equal(result.success, false);
  assert.equal(typeof result.error.message, 'string');
  assert.notEqual(result.error.message.length, 0);
});

test('customerService: 28P01 · WEAK_PASSWORD · P0001 를 화면용 오류로 바꾼다', async () => {
  const cases = [
    [{ code: '28P01', message: 'INVALID_CREDENTIALS' }, 'invalid_password'],
    [{ code: '22023', message: 'WEAK_PASSWORD' }, 'invalid_new_password'],
    [{ code: 'P0001', message: 'RATE_LIMITED', details: '3600' }, 'rate_limited'],
  ];

  for (const [error, expectedCode] of cases) {
    const { customerService } = loadModule('src/services/customerService.js', {
      './supabase': { ensureAuthenticatedSession: async () => ({ ok: true, session: { token: 't' } }) },
      './supabaseClient': {
        supabaseClient: {
          updateMyPassword: async () => ({ data: null, error }),
          deleteMyAccount: async () => ({ data: null, error }),
        },
      },
    });

    assert.equal((await customerService.updateMyPassword('a', 'b')).error.code, expectedCode);
    assert.equal((await customerService.deleteCustomer('a')).error.code, expectedCode);
  }
});
