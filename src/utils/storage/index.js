import { coreStorage, STORAGE_KEYS } from './core';
import { imageStorage } from './images';
import { cardsStorage } from './cards';
import { historyStorage } from './history';
import { userStorage } from './user';

export { STORAGE_KEYS };

export const storage = {
  ...coreStorage,
  ...imageStorage,
  ...cardsStorage,
  ...historyStorage,
  ...userStorage,
};
