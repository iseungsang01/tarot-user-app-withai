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
        updateMyPassword: async (payload) => { calls.push(payload); return { data: true, error: null }; },
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
        deleteMyAccount: async (payload) => { calls.push(payload); return { data: true, error: null }; },
      },
    },
  });

  const result = await customerService.deleteCustomer('ignored-customer-id', 'password');

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
