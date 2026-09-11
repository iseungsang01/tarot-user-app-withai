import { coreStorage, STORAGE_KEYS } from './core';
import { imageStorage } from './images';
import { cardsStorage } from './cards';
import { userStorage } from './user';
import { consentStorage } from './consent';

export { STORAGE_KEYS };

export const storage = {
  ...coreStorage,
  ...imageStorage,
  ...cardsStorage,
  ...userStorage,
  ...consentStorage,
};
