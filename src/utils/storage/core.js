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
  AI_CHAT_HISTORY: 'ai_chat_history',
};

export const coreStorage = {
  STORAGE_KEYS,

  async save(key, value) {
    try { await AsyncStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.error(`Storage save error (${key}):`, e); }
  },

  async get(key) {
    try {
      const val = await AsyncStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch (e) { console.error(`Storage get error (${key}):`, e); return null; }
  },

  async remove(key) {
    try { await AsyncStorage.removeItem(key); }
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

  async _updateMap(key, id, value, isDelete = false) {
    const data = await this.get(key) || {};
    if (isDelete) delete data[id]; else data[id] = value;
    await this.save(key, data);
  },

  async _cleanup(key, validIds) {
    console.log('🧹 [Storage] _cleanup 시작:', key);
    const data = await this.get(key) || {};
    const beforeCount = Object.keys(data).length;

    const filtered = Object.fromEntries(
      Object.entries(data).filter(([id]) => validIds.includes(parseInt(id)))
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
