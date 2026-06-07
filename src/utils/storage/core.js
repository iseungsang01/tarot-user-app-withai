import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  CUSTOMER: 'tarot_customer',
  CUSTOMER_SESSION: 'tarot_customer_session',
  SAVED_PHONE: 'saved_phone',
  REMEMBER_ME: 'remember_me',
  SELECTED_CARDS: 'selected_cards',
  CARD_REVIEWS: 'card_reviews',
  CARD_TITLES: 'card_titles',
  CARD_AI_INSIGHTS: 'card_ai_insights',
  CARD_IMAGES: 'card_images',
  IMAGE_CACHE: 'image_cache',
  READ_NOTICES: 'read_notices',
  APP_SETTINGS: 'app_settings',
  VISIT_CACHE: 'visit_cache',
  COUPON_CACHE: 'coupon_cache',
  LAST_SYNC: 'last_sync',
  DAILY_FORTUNE: 'daily_fortune',
  ATTENDANCE: 'attendance_history',
  OFFLINE_VISIT_HISTORY: 'offline_visit_history',
  COACH_MARKS: 'has_seen_main_coach_marks_v1',
  DRAWER_AI_USAGE: 'drawer_ai_usage',
};

const LOCAL_SCOPE_PREFIX = 'tarot_local';
const MIGRATION_PREFIX = `${LOCAL_SCOPE_PREFIX}:migration`;

const SCOPED_STORAGE_KEYS = new Set([
  STORAGE_KEYS.SELECTED_CARDS,
  STORAGE_KEYS.CARD_REVIEWS,
  STORAGE_KEYS.CARD_TITLES,
  STORAGE_KEYS.CARD_AI_INSIGHTS,
  STORAGE_KEYS.CARD_IMAGES,
  STORAGE_KEYS.IMAGE_CACHE,
  STORAGE_KEYS.READ_NOTICES,
  STORAGE_KEYS.DAILY_FORTUNE,
  STORAGE_KEYS.ATTENDANCE,
  STORAGE_KEYS.OFFLINE_VISIT_HISTORY,
  STORAGE_KEYS.COACH_MARKS,
  STORAGE_KEYS.DRAWER_AI_USAGE,
]);

const safeParse = (raw, fallback = null) => {
  if (raw === null || raw === undefined) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
};

const normalizeScopedValue = (key, raw) => {
  if (raw === null || raw === undefined) return null;
  if (key === STORAGE_KEYS.COACH_MARKS && (raw === 'true' || raw === 'false')) {
    return raw === 'true';
  }
  return safeParse(raw, raw);
};

const serializeScopedValue = (key, value) => {
  if (key === STORAGE_KEYS.COACH_MARKS && typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return JSON.stringify(value);
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

  if (key === STORAGE_KEYS.COACH_MARKS) return Boolean(source) || Boolean(target);
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
      await AsyncStorage.setItem(resolvedKey, serializeScopedValue(key, value));
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
      if (scopedVal !== null) return normalizeScopedValue(key, scopedVal);

      const legacyVal = await AsyncStorage.getItem(key);
      return normalizeScopedValue(key, legacyVal);
    } catch (e) { console.error(`Storage get error (${key}):`, e); return null; }
  },

  async remove(key) {
    try {
      const resolvedKey = shouldScope(key) ? scopeKey(await getCurrentScope(), key) : key;
      await AsyncStorage.removeItem(resolvedKey);
    }
    catch (e) { console.error(`Storage remove error (${key}):`, e); }
  },

  async clear() {
    try { await AsyncStorage.clear(); }
    catch (e) { console.error('Storage clear error:', e); }
  },

  async getAllKeys() {
    try { return await AsyncStorage.getAllKeys(); }
    catch (e) { console.error('Storage getAllKeys error:', e); return []; }
  },

  async getScopedKey(key, scope = null) {
    const resolvedScope = scope || await getCurrentScope();
    return shouldScope(key) ? scopeKey(resolvedScope, key) : key;
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

        const sourceValue = normalizeScopedValue(key, sourceRaw);
        const targetKey = scopeKey(targetScope, key);
        const targetValue = normalizeScopedValue(key, await AsyncStorage.getItem(targetKey));
        const merged = mergeValues(key, sourceValue, targetValue);

        await AsyncStorage.setItem(targetKey, serializeScopedValue(key, merged));
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
  },

  async _cleanup(key, validIds) {
    console.log('🧹 [Storage] _cleanup 시작:', key);
    const data = await this.get(key) || {};
    const beforeCount = Object.keys(data).length;

    const validIdSet = new Set((validIds || []).map((id) => String(id)));
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([id]) => validIdSet.has(String(id)))
    );

    const afterCount = Object.keys(filtered).length;
    const removedCount = beforeCount - afterCount;

    if (removedCount > 0) {
      await this.save(key, filtered);
      console.log('✅ [Storage] _cleanup 완료:', removedCount, '개 삭제됨');
    }

    return removedCount;
  }
};
