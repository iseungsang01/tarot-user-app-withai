import { coreStorage, STORAGE_KEYS } from './core';
import { CONSENT_VERSION } from '../../constants/legal';

/**
 * 약관 동의 기록.
 *
 * 기기 안에만 남는 기록이다. customers 테이블은 매니저 앱과 공유해서 단독으로 컬럼을
 * 못 늘리기 때문에, 서버 쪽 동의 이력은 매니저 앱과 조율이 끝나야 넣을 수 있다
 * (docs/manager-app-db-issues.md 참고). 그때까지는 이게 유일한 기록이다.
 */
export const consentStorage = {
  async saveConsent(agreed) {
    await coreStorage.save(STORAGE_KEYS.TERMS_CONSENT, {
      version: CONSENT_VERSION,
      agreedAt: new Date().toISOString(),
      items: agreed,
    });
  },

  async getConsent() {
    return await coreStorage.get(STORAGE_KEYS.TERMS_CONSENT) || null;
  },

  /** 저장된 동의가 현재 버전인지. 약관을 개정하면 false 가 되어 다시 받을 수 있다. */
  async hasCurrentConsent() {
    const record = await consentStorage.getConsent();
    return record?.version === CONSENT_VERSION;
  },
};
