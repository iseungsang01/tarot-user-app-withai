/**
 * 세션 토큰은 AsyncStorage(암호화 없는 SQLite, 기기 백업에 포함)가 아니라
 * expo-secure-store(Android Keystore 로 암호화, 백업 제외)에 둔다.
 * 웹·단위 테스트처럼 네이티브 모듈이 없으면 null 을 돌려주고, 호출부는 예전처럼
 * AsyncStorage 에 그대로 둔다.
 */
const SECURE_TOKEN_KEY = 'tarot_customer_session_token';

let secureStore;
const getSecureStore = () => {
  if (secureStore !== undefined) return secureStore;
  secureStore = null;
  // expo 가 빌드할 때 EXPO_OS 를 플랫폼 이름으로 박는다. 웹에는 보안 저장소가 없다.
  if (process.env.EXPO_OS === 'web') return secureStore;
  try {
    const mod = require('expo-secure-store');
    if (typeof mod?.setItemAsync === 'function') secureStore = mod;
  } catch {
    secureStore = null;
  }
  return secureStore;
};

export const secureToken = {
  isAvailable: () => getSecureStore() !== null,
  async get() {
    return (await getSecureStore()?.getItemAsync(SECURE_TOKEN_KEY)) ?? null;
  },
  async set(token) {
    await getSecureStore()?.setItemAsync(SECURE_TOKEN_KEY, token);
  },
  async remove() {
    await getSecureStore()?.deleteItemAsync(SECURE_TOKEN_KEY);
  },
};
