import { coreStorage, STORAGE_KEYS } from './core';
import { imageStorage } from './images';
import { cardsStorage } from './cards';
import { historyStorage } from './history';
import { userStorage } from './user';
import * as drawerAIUsageStorage from './drawerAIUsage';

export { STORAGE_KEYS };
export * from './drawerAIUsage';

export const storage = {
  ...coreStorage,
  ...imageStorage,
  ...cardsStorage,
  ...historyStorage,
  ...userStorage,
  ...drawerAIUsageStorage,
};
