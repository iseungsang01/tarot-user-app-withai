import { coreStorage, STORAGE_KEYS } from './core';

export const userStorage = {
  async markNoticeAsRead(noticeId) { await this.markNoticesAsRead([noticeId]); },
  async markNoticesAsRead(noticeIds) {
    const read = await coreStorage.get(STORAGE_KEYS.READ_NOTICES) || [];
    const updated = [...new Set([...read, ...noticeIds])];
    await coreStorage.save(STORAGE_KEYS.READ_NOTICES, updated);
  },
  async isNoticeRead(noticeId) { return (await coreStorage.get(STORAGE_KEYS.READ_NOTICES) || []).includes(noticeId); },
  async getReadNotices() { return await coreStorage.get(STORAGE_KEYS.READ_NOTICES) || []; },
  async getUnreadNoticeCount(allNoticeIds) {
    const read = await coreStorage.get(STORAGE_KEYS.READ_NOTICES) || [];
    return allNoticeIds.filter(id => !read.includes(id)).length;
  },
  async syncReadNotices(activeIds) {
    const read = await coreStorage.get(STORAGE_KEYS.READ_NOTICES) || [];
    const filtered = read.filter(id => activeIds.includes(id));
    if (read.length !== filtered.length) {
      await coreStorage.save(STORAGE_KEYS.READ_NOTICES, filtered);
    }
  },

  async saveAppSettings(settings) {
    const curr = await coreStorage.get(STORAGE_KEYS.APP_SETTINGS) || {};
    await coreStorage.save(STORAGE_KEYS.APP_SETTINGS, { ...curr, ...settings });
  },
  async getAppSettings() {
    return await coreStorage.get(STORAGE_KEYS.APP_SETTINGS) || { darkMode: true, notifications: true, autoRefresh: true };
  },

  _getLocalDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },

  async saveDailyFortune(fortune, dateStr) {
    const date = dateStr || this._getLocalDateString();
    const allFortunes = await coreStorage.get(STORAGE_KEYS.DAILY_FORTUNE) || {};
    allFortunes[date] = fortune;
    await coreStorage.save(STORAGE_KEYS.DAILY_FORTUNE, allFortunes);
  },
  async getDailyFortune(dateStr) {
    const date = dateStr || this._getLocalDateString();
    const allFortunes = await coreStorage.get(STORAGE_KEYS.DAILY_FORTUNE) || {};
    return allFortunes[date] || null;
  },
  async getAllFortunes() {
    return await coreStorage.get(STORAGE_KEYS.DAILY_FORTUNE) || {};
  },
  async deleteDailyFortune(dateStr) {
    const date = dateStr || this._getLocalDateString();
    const allFortunes = await coreStorage.get(STORAGE_KEYS.DAILY_FORTUNE) || {};
    if (allFortunes[date]) {
      delete allFortunes[date];
      await coreStorage.save(STORAGE_KEYS.DAILY_FORTUNE, allFortunes);
      return true;
    }
    return false;
  },

  async saveAttendance(dateStr) {
    const date = dateStr || this._getLocalDateString();
    const history = await coreStorage.get(STORAGE_KEYS.ATTENDANCE) || [];
    if (!history.includes(date)) {
      history.push(date);
      await coreStorage.save(STORAGE_KEYS.ATTENDANCE, history);
    }
  },
  async getAttendanceHistory() {
    return await coreStorage.get(STORAGE_KEYS.ATTENDANCE) || [];
  },
  async checkAttendance(dateStr) {
    const date = dateStr || this._getLocalDateString();
    const history = await coreStorage.get(STORAGE_KEYS.ATTENDANCE) || [];
    return history.includes(date);
  }
};
