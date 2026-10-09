const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

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
