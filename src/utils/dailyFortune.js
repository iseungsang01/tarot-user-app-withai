import { MAJOR_ARCANA } from '../constants/TarotCards';

export const MAX_DAILY_FORTUNE_DRAWS = 3;

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

export const getRemainingDraws = (fortune) => Math.max(0, MAX_DAILY_FORTUNE_DRAWS - getStoredDrawCount(fortune));

export const canDrawDailyFortune = (fortune) => getStoredDrawCount(fortune) < MAX_DAILY_FORTUNE_DRAWS;

export const getDrawButtonLabel = (fortune) => {
  const drawCount = getStoredDrawCount(fortune);
  const remaining = Math.max(0, MAX_DAILY_FORTUNE_DRAWS - drawCount);

  if (drawCount <= 0) return '오늘의 카드 뽑기';
  if (remaining <= 0) return '오늘의 카드는 모두 뽑았습니다';
  return `다시 뽑기 (남은 횟수 ${remaining}회)`;
};

export const pickRandomMajorArcana = () => MAJOR_ARCANA[Math.floor(Math.random() * MAJOR_ARCANA.length)];

export const getCardById = (cardId) => MAJOR_ARCANA.find((card) => card.id === cardId) || null;

export const getCardImageSource = (fortuneOrCard) => {
  const localCard = getCardById(fortuneOrCard?.cardId || fortuneOrCard?.id);
  const cardImage = localCard?.image || fortuneOrCard?.cardImage || fortuneOrCard?.image;
  if (!cardImage) return null;
  return typeof cardImage === 'string' ? { uri: cardImage } : cardImage;
};

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
  cardImage: card.image,
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
