import { supabaseClient } from './supabaseClient';
import { storage } from '../utils/storage';
import { STORAGE_KEYS } from '../utils/storage/core';

const CUSTOMER_KEY = STORAGE_KEYS.CUSTOMER;
const CUSTOMER_SESSION_KEY = STORAGE_KEYS.CUSTOMER_SESSION;

const saveAuthenticatedCustomer = async ({ customer, sessionToken, sessionType = 'customer' }) => {
  if (!customer || !sessionToken) return null;

  if (!customer.isGuest && customer.id) {
    await storage.migrateLocalDataToMember?.(customer.id);
  }

  await storage.save(CUSTOMER_SESSION_KEY, {
    token: sessionToken,
    customerId: customer.id,
    type: sessionType,
    savedAt: new Date().toISOString(),
  });
  await storage.save(CUSTOMER_KEY, customer);

  return customer;
};

const getStoredSession = async () => storage.get(CUSTOMER_SESSION_KEY);

const randomHex = (byteLength) => {
  const bytes = new Uint8Array(byteLength);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

// 설치마다 한 번 만들어 계속 쓴다. 전화번호·타임존처럼 남이 맞힐 수 있는 값이면
// 공격자가 피해자의 "아는 기기"를 흉내 낼 수 있다.
const getDeviceId = async () => {
  const saved = await storage.get(STORAGE_KEYS.DEVICE_ID);
  if (typeof saved === 'string' && /^[0-9a-f]{32}$/.test(saved)) return saved;
  const created = randomHex(16);
  await storage.save(STORAGE_KEYS.DEVICE_ID, created);
  return created;
};

const LOGOUT_REMOTE_TIMEOUT_MS = 1500;

const settleWithin = async (operation, timeoutMs = LOGOUT_REMOTE_TIMEOUT_MS) => {
  if (!operation || typeof operation.then !== 'function') return null;

  let timeoutId;
  try {
    return await Promise.race([
      Promise.resolve(operation).catch(() => null),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

// 서버 reason 은 코드라 화면에 그대로 쓰지 않는다(db-redesign §2-1).
const retryAfterText = (error) => {
  const seconds = Number(error?.details);
  if (!Number.isFinite(seconds) || seconds <= 0) return '잠시 후';
  return seconds >= 60 ? `${Math.ceil(seconds / 60)}분 후` : `${Math.ceil(seconds)}초 후`;
};

const getLoginFailureMessage = (error) => {
  if (error?.code === '28P01') return '전화번호 또는 비밀번호가 일치하지 않습니다.';
  if (error?.code === 'P0001') return `로그인 시도가 너무 많습니다. ${retryAfterText(error)} 다시 시도해주세요.`;
  return '서버 연결 중 오류가 발생했습니다.';
};

const getRegisterFailureMessage = (error) => {
  if (error?.code === '23505') return '이미 가입된 전화번호입니다. 로그인 화면에서 기존 계정으로 로그인해주세요.';
  if (error?.message === 'WEAK_PASSWORD') return '비밀번호는 6자 이상이어야 하고 123456 은 쓸 수 없습니다.';
  if (error?.code === '22023') return '입력한 정보를 다시 확인해주세요.';
  if (error?.code === 'P0001') return `가입 시도가 너무 많습니다. ${retryAfterText(error)} 다시 시도해주세요.`;
  return '회원가입에 실패했습니다.';
};

const GUEST_USER = { id: 'guest', nickname: '게스트', isGuest: true, current_stamps: 0 };

// login_customer 와 고객 본인이 부른 register_customer 는 같은 응답을 돌려준다.
const saveSessionResponse = async (data) => {
  if (!data?.session_token || !data?.customer?.id) {
    return {
      data: null,
      error: { message: '로그인 세션을 만들지 못했습니다. 다시 로그인해주세요.', code: 'AUTH_SESSION_FAILED' },
    };
  }
  const customer = await saveAuthenticatedCustomer({ customer: data.customer, sessionToken: data.session_token });
  return { data: customer, error: null };
};

export const authService = {
  async login(phoneNumber, password) {
    try {
      const { data, error } = await supabaseClient.loginCustomer({
        p_phone: phoneNumber.trim(),
        p_password: password,
        p_client_fingerprint: await getDeviceId(),
      });
      if (error) return { data: null, error: { message: getLoginFailureMessage(error), code: error.code } };
      return saveSessionResponse(data);
    } catch (error) {
      console.error('❌ 로그인 오류:', error);
      return { data: null, error: { message: '알 수 없는 오류가 발생했습니다.' } };
    }
  },

  async register(phoneNumber, password, nickname = '') {
    try {
      const { data, error } = await supabaseClient.registerCustomer({
        p_phone: phoneNumber.trim(),
        p_password: password,
        p_nickname: nickname,
        // 가입하면서 세션이 생기므로 이 기기를 "아는 기기"로 남긴다(login 과 같은 값).
        p_client_fingerprint: await getDeviceId(),
      });
      if (error) return { data: null, error: { message: getRegisterFailureMessage(error), code: error.code } };
      return saveSessionResponse(data);
    } catch (error) {
      console.error('❌ 가입 오류:', error);
      return { data: null, error: { message: '알 수 없는 오류가 발생했습니다.' } };
    }
  },

  async guestLogin() {
    try {
      const { data, error } = await supabaseClient.issueGuestSession();
      if (error || !data?.session_token) {
        return {
          data: null,
          error: {
            message: error?.code === 'P0001'
              ? `게스트 접속이 너무 많습니다. ${retryAfterText(error)} 다시 시도해주세요.`
              : '게스트 세션을 만들지 못했습니다. 잠시 후 다시 시도해주세요.',
            code: error?.code || 'GUEST_SESSION_FAILED',
          },
        };
      }

      const guest = await saveAuthenticatedCustomer({
        customer: GUEST_USER,
        sessionToken: data.session_token,
        sessionType: 'guest',
      });
      return { data: guest, error: null };
    } catch (error) {
      console.error('Guest Login Error:', error);
      return { data: null, error: { message: '게스트 로그인 중 오류가 발생했습니다.' } };
    }
  },

  async logout() {
    const session = await getStoredSession();

    await storage.remove(CUSTOMER_SESSION_KEY);
    await storage.remove(CUSTOMER_KEY);

    // 고객·게스트 공용이고, 토큰이 이미 폐기됐어도 서버는 오류를 내지 않는다.
    if (session?.token) await settleWithin(supabaseClient.logout({ p_session_token: session.token }));
  },

  // 앱 시작 시 저장된 세션을 복원한다. 서버가 세션을 무효라고 할 때만 지우고,
  // 네트워크 오류 등은 저장된 고객 정보로 계속 진행한다.
  async getStoredCustomer() {
    try {
      const session = await getStoredSession();
      if (!session?.token) {
        await storage.remove(CUSTOMER_KEY);
        return null;
      }

      if (session.type === 'guest') {
        const storedGuest = await storage.get(CUSTOMER_KEY);
        return storedGuest?.isGuest ? storedGuest : GUEST_USER;
      }

      const { data, error } = await supabaseClient.getMyProfile({ p_session_token: session.token });
      if (error?.reason === 'INVALID_SESSION' || (!error && !data?.id)) {
        await this.logout();
        return null;
      }
      if (error) return storage.get(CUSTOMER_KEY);

      return saveAuthenticatedCustomer({ customer: data, sessionToken: session.token });
    } catch {
      return null;
    }
  },

  async refreshCustomer(customerId) {
    if (!customerId) return null;

    try {
      const session = await getStoredSession();
      if (!session?.token) return null;

      const { data, error } = await supabaseClient.getMyProfile({ p_session_token: session.token });
      if (error || data?.id !== customerId) return null;

      return saveAuthenticatedCustomer({ customer: data, sessionToken: session.token });
    } catch (e) {
      console.error('Refresh Error:', e);
      return null;
    }
  },
};
