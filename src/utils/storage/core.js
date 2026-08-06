import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  CUSTOMER: 'tarot_customer',
  CUSTOMER_SESSION: 'tarot_customer_session',
  CARD_REVIEWS: 'card_reviews',
  CARD_TITLES: 'card_titles',
  CARD_AI_INSIGHTS: 'card_ai_insights',
  CARD_IMAGES: 'card_images',
  READ_NOTICES: 'read_notices',
  DAILY_FORTUNE: 'daily_fortune',
  ATTENDANCE: 'attendance_history',
  OFFLINE_VISIT_HISTORY: 'offline_visit_history',
  DRAWER_AI_USAGE: 'drawer_ai_usage',
};

const LOCAL_SCOPE_PREFIX = 'tarot_local';
const MIGRATION_PREFIX = `${LOCAL_SCOPE_PREFIX}:migration`;

const SCOPED_STORAGE_KEYS = new Set([
  STORAGE_KEYS.CARD_REVIEWS,
  STORAGE_KEYS.CARD_TITLES,
  STORAGE_KEYS.CARD_AI_INSIGHTS,
  STORAGE_KEYS.CARD_IMAGES,
  STORAGE_KEYS.READ_NOTICES,
  STORAGE_KEYS.DAILY_FORTUNE,
  STORAGE_KEYS.ATTENDANCE,
  STORAGE_KEYS.OFFLINE_VISIT_HISTORY,
  STORAGE_KEYS.DRAWER_AI_USAGE,
]);

const safeParse = (raw, fallback = null) => {
  if (raw === null || raw === undefined) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
};

const normalizeScopedValue = (raw) => {
  if (raw === null || raw === undefined) return null;
  return safeParse(raw, raw);
};

const getStoredJson = async (key) => {
  try {
    return safeParse(await AsyncStorage.getItem(key));
  } catch {
    return null;
  }
};

const getCurrentScope = async () => {
  const session = await getStoredJson(STORAGE_KEYS.CUSTOMER_SESSION);
  if (session?.type === 'ai_guest_session' || session?.customerId === 'guest') return 'guest';
  if (session?.customerId) return `member:${session.customerId}`;

  const customer = await getStoredJson(STORAGE_KEYS.CUSTOMER);
  if (customer?.isGuest || customer?.id === 'guest') return 'guest';
  if (customer?.id) return `member:${customer.id}`;
  return 'guest';
};

const scopeKey = (scope, key) => `${LOCAL_SCOPE_PREFIX}:${scope}:${key}`;
const shouldScope = (key) => SCOPED_STORAGE_KEYS.has(key);

const mergeById = (source = [], target = []) => {
  const byId = new Map();
  [...source, ...target].forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const id = item.id ?? `${item.visit_date || ''}:${item.title || item.drawer_title || ''}:${item.card_review || ''}`;
    byId.set(String(id), { ...(byId.get(String(id)) || {}), ...item });
  });
  return Array.from(byId.values()).sort((a, b) => new Date(b.visit_date || 0) - new Date(a.visit_date || 0));
};

const mergeValues = (key, source, target) => {
  if (source === null || source === undefined) return target;
  if (target === null || target === undefined) return source;

  if (key === STORAGE_KEYS.OFFLINE_VISIT_HISTORY) return mergeById(source, target);
  if (Array.isArray(source) || Array.isArray(target)) {
    return [...new Set([...(source || []), ...(target || [])])];
  }
  if (typeof source === 'object' && typeof target === 'object') {
    return { ...source, ...target };
  }
  return target;
};

const scopedKeysForMigration = Array.from(SCOPED_STORAGE_KEYS);

export const coreStorage = {
  STORAGE_KEYS,

  async save(key, value) {
    try {
      const resolvedKey = shouldScope(key) ? scopeKey(await getCurrentScope(), key) : key;
      await AsyncStorage.setItem(resolvedKey, JSON.stringify(value));
    }
    catch (e) { console.error(`Storage save error (${key}):`, e); }
  },

  async get(key) {
    try {
      if (!shouldScope(key)) {
        const val = await AsyncStorage.getItem(key);
        return val ? JSON.parse(val) : null;
      }

      const scopedVal = await AsyncStorage.getItem(scopeKey(await getCurrentScope(), key));
      if (scopedVal !== null) return normalizeScopedValue(scopedVal);

      const legacyVal = await AsyncStorage.getItem(key);
      return normalizeScopedValue(legacyVal);
    } catch (e) { console.error(`Storage get error (${key}):`, e); return null; }
  },

  async remove(key) {
    try {
      const resolvedKey = shouldScope(key) ? scopeKey(await getCurrentScope(), key) : key;
      await AsyncStorage.removeItem(resolvedKey);
    }
    catch (e) { console.error(`Storage remove error (${key}):`, e); }
  },

  async migrateLocalDataToMember(customerId) {
    if (!customerId || customerId === 'guest') return { migrated: false, reason: 'invalid_customer' };

    const targetScope = `member:${customerId}`;
    const sources = [
      { id: 'legacy', keyFor: (key) => key },
      { id: 'guest', keyFor: (key) => scopeKey('guest', key) },
    ];
    const summary = {};

    for (const source of sources) {
      const markerKey = `${MIGRATION_PREFIX}:${source.id}:to:${targetScope}`;
      let changed = false;
      for (const key of scopedKeysForMigration) {
        const sourceRaw = await AsyncStorage.getItem(source.keyFor(key));
        if (sourceRaw === null) continue;

        const sourceValue = normalizeScopedValue(sourceRaw);
        const targetKey = scopeKey(targetScope, key);
        const targetValue = normalizeScopedValue(await AsyncStorage.getItem(targetKey));
        const merged = mergeValues(key, sourceValue, targetValue);

        await AsyncStorage.setItem(targetKey, JSON.stringify(merged));
        changed = true;
      }

      await AsyncStorage.setItem(markerKey, JSON.stringify({ migratedAt: new Date().toISOString() }));
      summary[source.id] = changed ? 'migrated' : 'empty';
    }

    return { migrated: true, customerId, summary };
  },

  async _updateMap(key, id, value, isDelete = false) {
    const data = await this.get(key) || {};
    if (isDelete) delete data[id]; else data[id] = value;
    await this.save(key, data);
  }
};
