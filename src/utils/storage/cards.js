import { coreStorage, STORAGE_KEYS } from './core';

/** visitId를 키로 하는 맵 하나에 대한 CRUD 묶음을 만든다. */
const cardField = (storageKey) => ({
  save: (visitId, value) => coreStorage._updateMap(storageKey, visitId, value),
  get: async (visitId) => (await coreStorage.get(storageKey) || {})[visitId] || null,
  getAll: async () => await coreStorage.get(storageKey) || {},
  remove: (visitId) => coreStorage._updateMap(storageKey, visitId, null, true),
});

const review = cardField(STORAGE_KEYS.CARD_REVIEWS);
const title = cardField(STORAGE_KEYS.CARD_TITLES);
const aiInsight = cardField(STORAGE_KEYS.CARD_AI_INSIGHTS);

export const cardsStorage = {
  saveCardReview: review.save,
  getCardReview: review.get,
  getAllCardReviews: review.getAll,
  deleteCardReview: review.remove,

  saveCardTitle: title.save,
  getCardTitle: title.get,
  getAllCardTitles: title.getAll,
  deleteCardTitle: title.remove,

  saveCardAIInsight: aiInsight.save,
  getCardAIInsight: aiInsight.get,
  getAllCardAIInsights: aiInsight.getAll,
  deleteCardAIInsight: aiInsight.remove,
};
