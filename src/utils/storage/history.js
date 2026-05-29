import { coreStorage, STORAGE_KEYS } from './core';

export const historyStorage = {
  async cacheVisits(visits) {
    await coreStorage.save(STORAGE_KEYS.VISIT_CACHE, visits);
    await coreStorage.save(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  },
  async getCachedVisits() { return await coreStorage.get(STORAGE_KEYS.VISIT_CACHE) || []; },
  async cacheCoupons(coupons) { await coreStorage.save(STORAGE_KEYS.COUPON_CACHE, coupons); },
  async getCachedCoupons() { return await coreStorage.get(STORAGE_KEYS.COUPON_CACHE) || []; },
  async getLastSyncTime() { return await coreStorage.get(STORAGE_KEYS.LAST_SYNC); },

  async clearOldCache(days = 7) {
    const last = await this.getLastSyncTime();
    if (last && (new Date() - new Date(last)) / 864e5 > days) {
      await Promise.all([
        coreStorage.remove(STORAGE_KEYS.VISIT_CACHE),
        coreStorage.remove(STORAGE_KEYS.COUPON_CACHE),
        coreStorage.remove(STORAGE_KEYS.LAST_SYNC)
      ]);
    }
  }
};
