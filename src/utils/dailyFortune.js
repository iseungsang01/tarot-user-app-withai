import { MAJOR_ARCANA } from '../constants/TarotCards';

export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getStoredDrawCount = (fortune) => {
  const parsed = Number(fortune?.drawCount);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fortune ? 1 : 0;
};

export const canDrawDailyFortune = () => true;

export const needsRewardedAdForDailyFortune = (fortune) => getStoredDrawCount(fortune) > 0;

export const getDrawButtonLabel = (fortune) => {
  const drawCount = getStoredDrawCount(fortune);

  if (drawCount <= 0) return '오늘의 카드 뽑기';
  return '광고 보고 다시 뽑기';
};

export const getUniformRandomIndex = (itemCount, random = Math.random) => {
  if (!Number.isInteger(itemCount) || itemCount <= 0) {
    throw new Error('itemCount must be a positive integer');
  }

  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('random must return a number in the range [0, 1)');
  }

  return Math.floor(value * itemCount);
};

export const pickRandomMajorArcana = (random = Math.random) => {
  const index = getUniformRandomIndex(MAJOR_ARCANA.length, random);
  return MAJOR_ARCANA[index];
};

export const getCardById = (cardId) => MAJOR_ARCANA.find((card) => card.id === cardId) || null;

export const buildCardContext = (card) => ({
  id: card.id,
  name: card.name,
  nameKr: card.nameKr,
  keywords: card.keywords || [],
  light: card.light || '',
  shadow: card.shadow || '',
  advice: card.advice || '',
  domains: {
    relationship: card.domains?.relationship || '',
    work: card.domains?.work || '',
    money: card.domains?.money || '',
    health: card.domains?.health || '',
  },
});

export const buildStoredDailyFortune = ({ card, fortunePayload, drawCount, drawnAt = new Date().toISOString() }) => ({
  cardId: card.id,
  cardName: card.nameKr,
  cardEnglishName: card.name,
  summary: fortunePayload?.summary || '',
  fortune: fortunePayload?.fortune || '',
  relationship: fortunePayload?.relationship || '',
  work: fortunePayload?.work || '',
  money: fortunePayload?.money || '',
  care: fortunePayload?.care || '',
  action: fortunePayload?.action || '',
  luckyColor: fortunePayload?.luckyColor || '골드',
  luckyItem: fortunePayload?.luckyItem || '작은 노트',
  drawCount,
  drawnAt,
});
