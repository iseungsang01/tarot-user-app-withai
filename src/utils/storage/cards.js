import { coreStorage, STORAGE_KEYS } from './core';

export const cardsStorage = {
  async saveCardReview(visitId, review) { await coreStorage._updateMap(STORAGE_KEYS.CARD_REVIEWS, visitId, review); },
  async getCardReview(visitId) { return (await coreStorage.get(STORAGE_KEYS.CARD_REVIEWS) || {})[visitId] || null; },
  async getAllCardReviews() { return await coreStorage.get(STORAGE_KEYS.CARD_REVIEWS) || {}; },
  async deleteCardReview(visitId) {
    const reviews = await coreStorage.get(STORAGE_KEYS.CARD_REVIEWS) || {};
    if (visitId in reviews) {
      await coreStorage._updateMap(STORAGE_KEYS.CARD_REVIEWS, visitId, null, true);
      return true;
    }
    return false;
  },

  async saveCardTitle(visitId, title) { await coreStorage._updateMap(STORAGE_KEYS.CARD_TITLES, visitId, title); },
  async getCardTitle(visitId) { return (await coreStorage.get(STORAGE_KEYS.CARD_TITLES) || {})[visitId] || null; },
  async getAllCardTitles() { return await coreStorage.get(STORAGE_KEYS.CARD_TITLES) || {}; },
  async deleteCardTitle(visitId) { await coreStorage._updateMap(STORAGE_KEYS.CARD_TITLES, visitId, null, true); },

  async saveCardAIInsight(visitId, insight) { await coreStorage._updateMap(STORAGE_KEYS.CARD_AI_INSIGHTS, visitId, insight); },
  async getCardAIInsight(visitId) { return (await coreStorage.get(STORAGE_KEYS.CARD_AI_INSIGHTS) || {})[visitId] || null; },
  async getAllCardAIInsights() { return await coreStorage.get(STORAGE_KEYS.CARD_AI_INSIGHTS) || {}; },
  async deleteCardAIInsight(visitId) { await coreStorage._updateMap(STORAGE_KEYS.CARD_AI_INSIGHTS, visitId, null, true); },
};
