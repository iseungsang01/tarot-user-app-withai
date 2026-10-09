import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureToken } from './secureToken';

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
  // 계정별이 아니라 기기별로 둔다. 가입 직후에 저장하는데 그 시점엔 스코프가
  // 게스트에서 회원으로 막 넘어가는 중이라, 스코프를 태우면 어느 쪽에 떨어질지 불안정하다.
  TERMS_CONSENT: 'terms_consent',
  // 진단 로그도 기기별이다. 로그인 이전이나 로그인 실패 자체가 남아야 하는데
  // 스코프를 태우면 그 구간이 게스트 쪽으로 흩어진다.
  DIAGNOSTIC_LOG: 'diagnostic_log',
  // 로그인 기기 식별값. 서버는 로그인에 성공한 적 있는 기기를 "아는 기기"로 보고
  // 대입 공격 중에도 그 기기의 로그인은 막지 않는다. 계정이 아니라 기기에 묶여야 한다.
  DEVICE_ID: 'device_id',
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

// 스코프 키는 과거에 원시 문자열로 저장된 값이 남아 있어, 파싱 실패 시 원본을 그대로 살린다.
const normalizeScopedValue = (raw) => safeParse(raw, raw);

const getStoredJson = async (key) => {
  try {
    return safeParse(await AsyncStorage.getItem(key));
  } catch {
    return null;
  }
};

// 스코프는 로그인/로그아웃 때만 바뀌는데 모든 get/save/remove가 이 값을 필요로 한다.
// 매번 다시 읽으면 스토리지 접근이 통째로 2~3배가 되므로 캐시하고,
// 스코프를 결정하는 두 키(CUSTOMER_SESSION · CUSTOMER)가 쓰일 때만 버린다.
const SCOPE_DECIDING_KEYS = new Set([STORAGE_KEYS.CUSTOMER_SESSION, STORAGE_KEYS.CUSTOMER]);
let cachedScope = null;

const resolveCurrentScope = async () => {
  const session = await getStoredJson(STORAGE_KEYS.CUSTOMER_SESSION);
  if (session?.type === 'guest') return 'guest';
  if (session?.customerId) return `member:${session.customerId}`;

  const customer = await getStoredJson(STORAGE_KEYS.CUSTOMER);
  if (customer?.isGuest || customer?.id === 'guest') return 'guest';
  if (customer?.id) return `member:${customer.id}`;
  return 'guest';
};

const getCurrentScope = async () => {
  if (cachedScope === null) cachedScope = await resolveCurrentScope();
  return cachedScope;
};

const invalidateScopeIfNeeded = (key) => {
  if (SCOPE_DECIDING_KEYS.has(key)) cachedScope = null;
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

// 세션 객체 중 token 만 보안 저장소로 뺀다. 나머지(customerId·type)는 스코프 판정에
// 동기적으로 자주 쓰여 AsyncStorage 에 남긴다.
const isSessionKey = (key) => key === STORAGE_KEYS.CUSTOMER_SESSION;

const saveSession = async (value) => {
  if (!secureToken.isAvailable() || !value || typeof value !== 'object' || !value.token) {
    await AsyncStorage.setItem(STORAGE_KEYS.CUSTOMER_SESSION, JSON.stringify(value));
    return;
  }
  const { token, ...rest } = value;
  await secureToken.set(token);
  await AsyncStorage.setItem(STORAGE_KEYS.CUSTOMER_SESSION, JSON.stringify(rest));
};

const getSession = async () => {
  const stored = safeParse(await AsyncStorage.getItem(STORAGE_KEYS.CUSTOMER_SESSION));
  if (!stored || typeof stored !== 'object' || !secureToken.isAvailable()) return stored;

  // 1.0.8 이하는 token 을 AsyncStorage 에 같이 저장했다. 읽는 김에 옮긴다.
  if (stored.token) {
    await saveSession(stored);
    return stored;
  }
  const token = await secureToken.get();
  return token ? { ...stored, token } : stored;
};

export const coreStorage = {
  STORAGE_KEYS,

  async save(key, value) {
    try {
      if (isSessionKey(key)) {
        await saveSession(value);
      } else {
        const resolvedKey = shouldScope(key) ? scopeKey(await getCurrentScope(), key) : key;
        await AsyncStorage.setItem(resolvedKey, JSON.stringify(value));
      }
      invalidateScopeIfNeeded(key);
    }
    catch (e) { console.error(`Storage save error (${key}):`, e); }
  },

  async get(key) {
    try {
      if (isSessionKey(key)) return await getSession();
      if (!shouldScope(key)) return safeParse(await AsyncStorage.getItem(key));

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
      if (isSessionKey(key) && secureToken.isAvailable()) await secureToken.remove();
      invalidateScopeIfNeeded(key);
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
