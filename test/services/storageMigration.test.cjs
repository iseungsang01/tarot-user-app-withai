const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/moduleLoader.cjs');

const createAsyncStorageMock = () => {
  const data = new Map();
  return {
    data,
    async getItem(key) { return data.has(key) ? data.get(key) : null; },
    async setItem(key, value) { data.set(key, String(value)); },
    async removeItem(key) { data.delete(key); },
    async clear() { data.clear(); },
    async getAllKeys() { return Array.from(data.keys()); },
  };
};

test('coreStorage migrates legacy and guest local data into member namespace once without duplicates', async () => {
  const AsyncStorage = createAsyncStorageMock();
  const { coreStorage, STORAGE_KEYS } = loadModule('src/utils/storage/core.js', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: AsyncStorage },
  });

  await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_VISIT_HISTORY, JSON.stringify([
    { id: 'local_1', visit_date: '2026-06-01', card_review: 'legacy note' },
  ]));
  await AsyncStorage.setItem(STORAGE_KEYS.CARD_REVIEWS, JSON.stringify({ 10: 'legacy review' }));
  await AsyncStorage.setItem(`tarot_local:guest:${STORAGE_KEYS.OFFLINE_VISIT_HISTORY}`, JSON.stringify([
    { id: 'local_1', visit_date: '2026-06-01', card_review: 'guest duplicate wins' },
    { id: 'local_2', visit_date: '2026-06-02', card_review: 'guest note' },
  ]));
  await AsyncStorage.setItem(`tarot_local:guest:${STORAGE_KEYS.DAILY_FORTUNE}`, JSON.stringify({
    '2026-06-06': { fortune: 'guest fortune' },
  }));

  const first = await coreStorage.migrateLocalDataToMember('member-1');
  const second = await coreStorage.migrateLocalDataToMember('member-1');

  assert.equal(first.migrated, true);
  assert.equal(second.summary.legacy, 'migrated');
  assert.equal(second.summary.guest, 'migrated');

  const visits = JSON.parse(await AsyncStorage.getItem(`tarot_local:member:member-1:${STORAGE_KEYS.OFFLINE_VISIT_HISTORY}`));
  assert.equal(visits.length, 2);
  assert.deepEqual(new Set(visits.map((visit) => visit.id)), new Set(['local_1', 'local_2']));

  const reviews = JSON.parse(await AsyncStorage.getItem(`tarot_local:member:member-1:${STORAGE_KEYS.CARD_REVIEWS}`));
  assert.deepEqual(reviews, { 10: 'legacy review' });

  const fortunes = JSON.parse(await AsyncStorage.getItem(`tarot_local:member:member-1:${STORAGE_KEYS.DAILY_FORTUNE}`));
  assert.deepEqual(fortunes, { '2026-06-06': { fortune: 'guest fortune' } });
});

test('coreStorage reads legacy scoped keys until a namespaced value exists', async () => {
  const AsyncStorage = createAsyncStorageMock();
  const { coreStorage, STORAGE_KEYS } = loadModule('src/utils/storage/core.js', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: AsyncStorage },
  });

  await AsyncStorage.setItem(STORAGE_KEYS.READ_NOTICES, JSON.stringify([1, 2]));
  assert.deepEqual(await coreStorage.get(STORAGE_KEYS.READ_NOTICES), [1, 2]);

  await coreStorage.save(STORAGE_KEYS.READ_NOTICES, [3]);
  assert.deepEqual(await coreStorage.get(STORAGE_KEYS.READ_NOTICES), [3]);
  assert.deepEqual(JSON.parse(await AsyncStorage.getItem(`tarot_local:guest:${STORAGE_KEYS.READ_NOTICES}`)), [3]);
});
