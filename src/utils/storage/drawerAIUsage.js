import { coreStorage, STORAGE_KEYS } from './core';

export const DRAWER_AI_USAGE_LIMITS = {
  voiceCondense: 30,
  polishReview: 30,
  historySummary: 30,
};

export const getDrawerAIUsageMonthKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const normalizeFeatureCount = (value) => {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.floor(count);
};

const normalizeMonthUsage = (usage = {}) => ({
  voiceCondense: normalizeFeatureCount(usage.voiceCondense),
  polishReview: normalizeFeatureCount(usage.polishReview),
  historySummary: normalizeFeatureCount(usage.historySummary),
});

export const getDrawerAIUsage = async (month = getDrawerAIUsageMonthKey()) => {
  const allUsage = await coreStorage.get(STORAGE_KEYS.DRAWER_AI_USAGE) || {};
  return normalizeMonthUsage(allUsage[month]);
};

export const getDrawerAIFeatureLimit = (featureKey) => DRAWER_AI_USAGE_LIMITS[featureKey] || 0;

export const getRemainingDrawerAIUsage = async (featureKey, month = getDrawerAIUsageMonthKey()) => {
  const usage = await getDrawerAIUsage(month);
  const limit = getDrawerAIFeatureLimit(featureKey);
  return Math.max(0, limit - normalizeFeatureCount(usage[featureKey]));
};

export const canUseDrawerAI = async (featureKey, month = getDrawerAIUsageMonthKey()) => {
  return (await getRemainingDrawerAIUsage(featureKey, month)) > 0;
};

export const incrementDrawerAIUsage = async (featureKey, month = getDrawerAIUsageMonthKey()) => {
  const limit = getDrawerAIFeatureLimit(featureKey);
  if (!limit) throw new Error(`Unknown drawer AI feature: ${featureKey}`);

  const allUsage = await coreStorage.get(STORAGE_KEYS.DRAWER_AI_USAGE) || {};
  const monthUsage = normalizeMonthUsage(allUsage[month]);
  const current = normalizeFeatureCount(monthUsage[featureKey]);
  if (current >= limit) {
    return { allowed: false, usage: monthUsage, remaining: 0 };
  }

  const nextUsage = {
    ...monthUsage,
    [featureKey]: current + 1,
  };
  await coreStorage.save(STORAGE_KEYS.DRAWER_AI_USAGE, {
    ...allUsage,
    [month]: nextUsage,
  });

  return {
    allowed: true,
    usage: nextUsage,
    remaining: Math.max(0, limit - nextUsage[featureKey]),
  };
};
