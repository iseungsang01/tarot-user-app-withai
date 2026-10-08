const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const root = path.join(__dirname, '../..');
const read = (relPath) => fs.readFileSync(path.join(root, relPath), 'utf8');
const { verifySsvCallback, derToRawSignature } = require('../../supabase/functions/admob-ssv/verify.ts');

const makeKey = () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const base64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  return { privateKey, verifierKey: { keyId: 1234, base64 } };
};

// Google 형식 그대로: 서명 대상은 '&signature=' 앞의 쿼리 전체, 서명은 DER 의 base64url.
const signQuery = (privateKey, content, keyId = 1234) => {
  const der = crypto.sign('sha256', Buffer.from(content), privateKey);
  return `${content}&signature=${der.toString('base64url')}&key_id=${keyId}`;
};

const CONTENT = 'ad_network=5450213213286189855&ad_unit=1234567890&custom_data=0123456789abcdef0123456789abcdef'
  + '&reward_amount=1&reward_item=redraw&timestamp=1507770365237823&transaction_id=18fa792de1bca816048293fc71035638'
  + '&user_id=';

test('admob-ssv: a callback signed by the AdMob key is accepted', async () => {
  const { privateKey, verifierKey } = makeKey();
  const params = await verifySsvCallback(signQuery(privateKey, CONTENT), [verifierKey]);
  assert.deepEqual(params, {
    customData: '0123456789abcdef0123456789abcdef',
    transactionId: '18fa792de1bca816048293fc71035638',
    adUnit: '1234567890',
  });
});

test('admob-ssv: forged, tampered or unknown-key callbacks are rejected', async () => {
  const { privateKey, verifierKey } = makeKey();
  const attacker = makeKey();

  // 공격자 키로 서명
  assert.equal(await verifySsvCallback(signQuery(attacker.privateKey, CONTENT), [verifierKey]), null);
  // 서명 후 nonce 바꿔치기
  const signed = signQuery(privateKey, CONTENT);
  const tampered = signed.replace('custom_data=0123', 'custom_data=ffff');
  assert.equal(await verifySsvCallback(tampered, [verifierKey]), null);
  // 서명 뒤에 덧붙인 custom_data 는 쓰지 않는다
  const appended = await verifySsvCallback(`${signed}&custom_data=ffffffffffffffffffffffffffffffff`, [verifierKey]);
  assert.equal(appended?.customData, '0123456789abcdef0123456789abcdef');
  // 모르는 key_id, 서명 없음, 깨진 DER
  assert.equal(await verifySsvCallback(signQuery(privateKey, CONTENT, 999), [verifierKey]), null);
  assert.equal(await verifySsvCallback(CONTENT, [verifierKey]), null);
  assert.equal(await verifySsvCallback(`${CONTENT}&signature=AAAA&key_id=1234`, [verifierKey]), null);
  assert.equal(derToRawSignature(new Uint8Array([0x30, 0x02, 0x02, 0x40])), null);
});

test('ai-proxy: daily fortune redraws are gated by a server-verified ad reward', () => {
  const index = read('supabase/functions/ai-proxy/index.ts');
  assert.match(index, /issue_ad_reward_nonce/);
  assert.match(index, /p_task:/);
  assert.match(index, /p_ad_nonce: adNonce/);

  const migration = read('supabase/migrations/20261008180000_daily_fortune_ad_reward_ssv.sql');
  assert.match(migration, /reason', 'ad_required'/);
  assert.match(migration, /reason', 'ad_pending'/);
  assert.match(migration, /DROP FUNCTION IF EXISTS public\.consume_ai_proxy_quota\(text, text\);/);
  for (const fn of ['issue_ad_reward_nonce(text)', 'record_ad_reward(text, text)', 'consume_ai_proxy_quota(text, text, text, text)']) {
    assert.ok(migration.includes(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated;`), fn);
    assert.ok(migration.includes(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role;`), fn);
  }

  // 콜백 함수는 Supabase JWT 없이 Google 이 부른다
  assert.match(read('supabase/config.toml'), /\[functions\.admob-ssv\]\s*\n(?:#.*\n)*verify_jwt = false/);
});

const createAsyncStorage = () => {
  const map = new Map();
  return {
    map,
    getItem: async (key) => (map.has(key) ? map.get(key) : null),
    setItem: async (key, value) => { map.set(key, value); },
    removeItem: async (key) => { map.delete(key); },
  };
};

const createSecureStore = () => {
  const map = new Map();
  return {
    map,
    getItemAsync: async (key) => (map.has(key) ? map.get(key) : null),
    setItemAsync: async (key, value) => { map.set(key, value); },
    deleteItemAsync: async (key) => { map.delete(key); },
  };
};

const loadCoreStorage = (asyncStorage, secureStore) => loadModule('src/utils/storage/core.js', {
  '@react-native-async-storage/async-storage': asyncStorage,
  'expo-secure-store': secureStore,
});

test('storage: the session token lives in the secure store, not AsyncStorage', async () => {
  const asyncStorage = createAsyncStorage();
  const secureStore = createSecureStore();
  const { coreStorage, STORAGE_KEYS } = loadCoreStorage(asyncStorage, secureStore);

  await coreStorage.save(STORAGE_KEYS.CUSTOMER_SESSION, { token: 'SECRET_TOKEN', customerId: 'c1', type: 'customer_rpc_session' });

  assert.doesNotMatch(asyncStorage.map.get(STORAGE_KEYS.CUSTOMER_SESSION), /SECRET_TOKEN/);
  assert.equal([...secureStore.map.values()][0], 'SECRET_TOKEN');
  assert.deepEqual(await coreStorage.get(STORAGE_KEYS.CUSTOMER_SESSION), { customerId: 'c1', type: 'customer_rpc_session', token: 'SECRET_TOKEN' });

  await coreStorage.remove(STORAGE_KEYS.CUSTOMER_SESSION);
  assert.equal(secureStore.map.size, 0);
  assert.equal(await coreStorage.get(STORAGE_KEYS.CUSTOMER_SESSION), null);
});

test('storage: a token saved by an older build is moved out of AsyncStorage on read', async () => {
  const asyncStorage = createAsyncStorage();
  const secureStore = createSecureStore();
  const { coreStorage, STORAGE_KEYS } = loadCoreStorage(asyncStorage, secureStore);
  asyncStorage.map.set(STORAGE_KEYS.CUSTOMER_SESSION, JSON.stringify({ token: 'OLD_TOKEN', customerId: 'c1' }));

  const session = await coreStorage.get(STORAGE_KEYS.CUSTOMER_SESSION);

  assert.equal(session.token, 'OLD_TOKEN');
  assert.doesNotMatch(asyncStorage.map.get(STORAGE_KEYS.CUSTOMER_SESSION), /OLD_TOKEN/);
  assert.equal([...secureStore.map.values()][0], 'OLD_TOKEN');
});
