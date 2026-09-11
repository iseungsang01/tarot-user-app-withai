const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const STORAGE_KEYS = { DIAGNOSTIC_LOG: 'diagnostic_log' };

const createStorageMock = (initial = null) => {
  const store = new Map();
  if (initial) store.set(STORAGE_KEYS.DIAGNOSTIC_LOG, initial);
  return {
    store,
    coreStorage: {
      get: async (key) => (store.has(key) ? store.get(key) : null),
      save: async (key, value) => { store.set(key, value); },
    },
    STORAGE_KEYS,
  };
};

const loadDiagnostics = (options = {}) => {
  const { platform = 'android', constants = { Release: '13', Brand: 'samsung', Model: 'SM-A516N' }, stored = null } = options;
  const storage = createStorageMock(stored);
  const mod = loadModule('src/utils/diagnostics.js', {
    'react-native': { Platform: { OS: platform, Version: 33, constants } },
    './storage/core': { coreStorage: storage.coreStorage, STORAGE_KEYS: storage.STORAGE_KEYS },
    '../constants/Config': { APP_INFO: { name: 'drawer', version: '1.0.8' } },
  });
  return { ...mod, storage };
};

test('diagnostics: never records admin passwords, session tokens, or phone numbers', () => {
  const { buildEntry } = loadDiagnostics();

  const entry = buildEntry(
    'TicketScreen.useCoupon',
    Object.assign(new Error('세션 abcdef0123456789abcdef0123456789ab 로 010-1234-5678 실패'), {
      code: 'invalid_admin_password',
    }),
    {
      adminPassword: 'hunter2',
      p_session_token: 'opaque-token',
      couponId: 12,
      screen: 'ticket',
    },
  );

  const serialized = JSON.stringify(entry);
  assert.doesNotMatch(serialized, /hunter2/);
  assert.doesNotMatch(serialized, /opaque-token/);
  assert.doesNotMatch(serialized, /010-1234-5678/);
  assert.doesNotMatch(serialized, /abcdef0123456789/);

  // 원인 추적에 필요한 것은 남아야 한다
  assert.equal(entry.code, 'invalid_admin_password');
  assert.equal(entry.ctx, 'TicketScreen.useCoupon');
  assert.equal(entry.extra.couponId, 12);
  assert.equal(entry.extra.screen, 'ticket');
});

test('diagnostics: keeps the newest 200 entries and reads them newest first', async () => {
  const { recordDiagnostic, readDiagnostics } = loadDiagnostics();

  for (let i = 0; i < 250; i += 1) {
    recordDiagnostic('ctx', new Error(`오류 ${i}`));
  }

  const entries = await readDiagnostics();

  assert.equal(entries.length, 200);
  assert.equal(entries[0].msg, '오류 249');
  assert.equal(entries[199].msg, '오류 50');
});

test('diagnostics: restores entries saved by a previous app run', async () => {
  const stored = [{ t: '2026-09-10T01:00:00.000Z', ctx: 'old', msg: '지난 실행에서 남은 기록' }];
  const { recordDiagnostic, readDiagnostics } = loadDiagnostics({ stored });

  recordDiagnostic('new', new Error('이번 실행'));
  const entries = await readDiagnostics();

  assert.equal(entries.length, 2);
  assert.equal(entries[0].msg, '이번 실행');
  assert.equal(entries[1].msg, '지난 실행에서 남은 기록');
});

test('diagnostics: device_info carries app version, device, and the most recent logs', async () => {
  const { recordDiagnostic, buildDeviceInfo } = loadDiagnostics();

  for (let i = 0; i < 60; i += 1) {
    recordDiagnostic('ctx', new Error(`오류 ${i}`));
  }

  const info = await buildDeviceInfo();

  assert.equal(info.app, '1.0.8');
  assert.equal(info.platform, 'android');
  assert.equal(info.os, 'Android 13');
  assert.equal(info.device, 'samsung SM-A516N');
  // 행이 비대해지지 않도록 접수에는 최근 50건만 싣는다
  assert.equal(info.logs.length, 50);
  assert.equal(info.logs[0].msg, '오류 59');
});

test('diagnostics: device summary leaves out Android hardware identifiers', () => {
  const { describeDevice } = loadDiagnostics({
    constants: { Release: '13', Brand: 'samsung', Model: 'SM-A516N', Serial: 'R58N123456X', Fingerprint: 'samsung/a51/a51:13/x' },
  });

  const serialized = JSON.stringify(describeDevice());
  assert.doesNotMatch(serialized, /R58N123456X/);
  assert.doesNotMatch(serialized, /fingerprint/i);
});

test('diagnostics: clearing wipes both the buffer and the stored copy', async () => {
  const { recordDiagnostic, readDiagnostics, clearDiagnostics, storage } = loadDiagnostics();

  recordDiagnostic('ctx', new Error('지워질 기록'));
  await readDiagnostics();
  await clearDiagnostics();

  assert.deepEqual(await readDiagnostics(), []);
  assert.deepEqual(storage.store.get(STORAGE_KEYS.DIAGNOSTIC_LOG), []);
});
