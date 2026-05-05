import { coreStorage, STORAGE_KEYS } from './core';

export const historyStorage = {
  async saveAIChatHistory(customerId, messages) {
    if (!customerId) return;
    const allHistories = await coreStorage.get(STORAGE_KEYS.AI_CHAT_HISTORY) || {};
    allHistories[customerId] = messages;
    await coreStorage.save(STORAGE_KEYS.AI_CHAT_HISTORY, allHistories);
  },

  async getAIChatHistory(customerId) {
    if (!customerId) return [];
    const allHistories = await coreStorage.get(STORAGE_KEYS.AI_CHAT_HISTORY) || {};
    const history = allHistories[customerId] || [];
    return history.map(msg => ({ ...msg, timestamp: msg.timestamp ? new Date(msg.timestamp) : null }));
  },

  async deleteAIChatHistory(customerId) {
    if (!customerId) return;
    const allHistories = await coreStorage.get(STORAGE_KEYS.AI_CHAT_HISTORY) || {};
    if (allHistories[customerId]) {
      delete allHistories[customerId];
      await coreStorage.save(STORAGE_KEYS.AI_CHAT_HISTORY, allHistories);
    }
  },

  async archiveAIChatSession(customerId, messages) {
    if (!customerId || !messages || messages.length <= 1) return;
    const sessions = await coreStorage.get(`ai_sessions_${customerId}`) || [];
    const firstUserMsg = messages.find(m => m.role === 'user');
    const title = firstUserMsg
      ? (firstUserMsg.content.length > 20 ? firstUserMsg.content.substring(0, 20) + '...' : firstUserMsg.content)
      : '새로운 상담';
    const newSession = { id: `session_${Date.now()}`, title, date: new Date().toISOString(), messageCount: messages.length, messages };
    sessions.unshift(newSession);
    await coreStorage.save(`ai_sessions_${customerId}`, sessions.slice(0, 50));
    return newSession;
  },

  async getAIChatSessions(customerId) {
    if (!customerId) return [];
    const sessions = await coreStorage.get(`ai_sessions_${customerId}`) || [];
    return sessions.map(session => ({
      ...session,
      messages: (session.messages || []).map(msg => ({ ...msg, timestamp: msg.timestamp ? new Date(msg.timestamp) : null }))
    }));
  },

  async deleteAIChatSession(customerId, sessionId) {
    if (!customerId || !sessionId) return;
    const sessions = await coreStorage.get(`ai_sessions_${customerId}`) || [];
    const filtered = sessions.filter(s => s.id !== sessionId);
    await coreStorage.save(`ai_sessions_${customerId}`, filtered);
  },

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
