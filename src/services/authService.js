import { supabaseClient } from './supabaseClient';
import { storage } from '../utils/storage';
import { STORAGE_KEYS } from '../utils/storage/core';

const CUSTOMER_KEY = STORAGE_KEYS.CUSTOMER;
const CUSTOMER_SESSION_KEY = STORAGE_KEYS.CUSTOMER_SESSION;

const LOGIN_GUARD_KEY = 'auth_login_guard';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

const defaultLoginGuard = { failedAttempts: 0, lockUntil: 0 };

const getLoginGuard = async () => (await storage.get(LOGIN_GUARD_KEY)) || { ...defaultLoginGuard };
const saveLoginGuard = async (guard) => storage.save(LOGIN_GUARD_KEY, guard);
const resetLoginGuard = async () => storage.remove(LOGIN_GUARD_KEY);

const normalizeCustomer = (payload) => payload?.customer || payload?.profile || payload;

const saveAuthenticatedCustomer = async ({ customer, sessionToken, sessionType = 'customer_rpc_session' }) => {
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

// 서버 message 는 영어이거나 내부 문구일 수 있어 화면에 그대로 쓰지 않는다.
const getFailureMessage = (resultData) => {
  if (resultData?.locked || resultData?.lock_expires_at) return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.';
  if (resultData?.reason === 'INTERNAL_ERROR') return '서버 연결 중 오류가 발생했습니다.';
  return '전화번호 또는 비밀번호가 일치하지 않습니다.';
};

const getRegisterFailureMessage = (resultData, fallback = '회원가입에 실패했습니다.') => {
  const message = resultData?.message || fallback;
  const normalizedMessage = message.toLowerCase();

  if (
    resultData?.reason === 'PHONE_ALREADY_REGISTERED'
    || normalizedMessage.includes('already registered')
    || normalizedMessage.includes('duplicate')
    || normalizedMessage.includes('unique')
    || normalizedMessage.includes('이미 가입')
  ) {
    return '이미 가입된 전화번호입니다. 로그인 화면에서 기존 계정으로 로그인해주세요.';
  }

  if (normalizedMessage.includes('password')) return '비밀번호는 6자 이상이어야 하고 123456 은 쓸 수 없습니다.';
  return fallback;
};

const getRpcFailureMessage = (rpcError) => {
  if (rpcError?.code === '22023' && rpcError?.message?.toLowerCase?.().includes('invalid salt')) {
    return '계정 비밀번호 저장 형식에 문제가 있습니다. 매장에 문의해주세요.';
  }

  return '서버 연결 중 오류가 발생했습니다.';
};

const getGuestLoginFailureMessage = (rpcError, resultData) => {
  if (rpcError?.code === 'PGRST202' && rpcError?.message?.includes('issue_ai_guest_session')) {
    return '게스트 로그인 서버 설정이 아직 적용되지 않았습니다. 관리자에게 문의해주세요.';
  }

  if (resultData?.code === 'GUEST_RATE_LIMITED') return resultData.message;
  return '게스트 세션을 만들지 못했습니다. 잠시 후 다시 시도해주세요.';
};

export const authService = {
  async login(phoneNumber, password) {
    try {
      const guard = await getLoginGuard();
      const clientFingerprint = await getDeviceId();

      const { data: resultData, error: rpcError } = await supabaseClient.loginCustomer({
        p_phone: phoneNumber.trim(),
        p_password: password,
        p_client_fingerprint: clientFingerprint,
      });

      if (rpcError) {
        console.error('❌ RPC 에러:', rpcError);
        return { data: null, error: { message: getRpcFailureMessage(rpcError) } };
      }

      if (!resultData || resultData.success === false) {
        const failedAttempts = (guard.failedAttempts || 0) + 1;
        const serverLockUntil = resultData?.lock_expires_at ? new Date(resultData.lock_expires_at).getTime() : 0;
        const lockUntil = serverLockUntil || (failedAttempts >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0);

        await saveLoginGuard({ failedAttempts, lockUntil });

        return {
          data: null,
          error: {
            message: getFailureMessage(resultData),
            lockedUntil: serverLockUntil || null,
          },
        };
      }

      const sessionToken = resultData.session_token;
      const customerData = normalizeCustomer(resultData);

      if (!sessionToken || !customerData?.id) {
        return {
          data: null,
          error: {
            message: '로그인 세션을 만들지 못했습니다. 다시 로그인해주세요.',
            code: 'AUTH_SESSION_FAILED',
            requiresReLogin: true,
          },
        };
      }

      const savedCustomer = await saveAuthenticatedCustomer({ customer: customerData, sessionToken });
      await resetLoginGuard();

      return { data: savedCustomer, error: null };
    } catch (error) {
      console.error('❌ 시스템 에러:', error);
      return { data: null, error: { message: '알 수 없는 오류가 발생했습니다.' } };
    }
  },

  async logout() {
    const session = await getStoredSession();

    await storage.remove(CUSTOMER_SESSION_KEY);
    await storage.remove(CUSTOMER_KEY);
    await resetLoginGuard();

    const cleanupTasks = [];

    if (session?.token && session.type === 'ai_guest_session') {
      cleanupTasks.push(settleWithin(supabaseClient.logoutAIGuestSession({ p_session_token: session.token })));
    } else if (session?.token) {
      cleanupTasks.push(settleWithin(supabaseClient.logoutCustomer({ p_session_token: session.token })));
    }

    await Promise.all(cleanupTasks);
  },

  async getStoredCustomer() {
    try {
      const session = await getStoredSession();
      if (!session?.token) {
        await storage.remove(CUSTOMER_KEY);
        return null;
      }

      if (session.type === 'ai_guest_session' || session.customerId === 'guest') {
        const storedGuest = await storage.get(CUSTOMER_KEY);
        if (storedGuest?.isGuest) return storedGuest;

        const guestUser = { id: 'guest', nickname: '게스트', isGuest: true, current_stamps: 0, visit_count: 0 };
        await storage.save(CUSTOMER_KEY, guestUser);
        return guestUser;
      }

      const { data, error } = await supabaseClient.getMyProfile({ p_session_token: session.token });
      if (error || !data?.success) {
        await this.logout();
        return null;
      }

      const customer = normalizeCustomer(data);
      if (!customer?.id) {
        await this.logout();
        return null;
      }

      return saveAuthenticatedCustomer({ customer, sessionToken: session.token });
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
      if (error || !data?.success) {
        console.error('❌ 정보 갱신 에러:', error?.message || data?.message);
        return null;
      }

      const customer = normalizeCustomer(data);
      if (!customer?.id || customer.id !== customerId) return null;

      return saveAuthenticatedCustomer({ customer, sessionToken: session.token });
    } catch (e) {
      console.error('Refresh Error:', e);
      return null;
    }
  },

  async register(phoneNumber, password, nickname = '') {
    try {
      const normalizedPhone = phoneNumber.trim();

      const { data: resultData, error: rpcError } = await supabaseClient.registerCustomer({
        p_phone: normalizedPhone,
        p_password: password,
        p_nickname: nickname,
      });

      if (rpcError) {
        console.error('❌ RPC 에러:', rpcError);
        return { data: null, error: { message: getRegisterFailureMessage(rpcError, getRpcFailureMessage(rpcError)) } };
      }

      if (!resultData || resultData.success === false) {
        return {
          data: null,
          error: { message: getRegisterFailureMessage(resultData) },
        };
      }

      return this.login(normalizedPhone, password);
    } catch (error) {
      console.error('❌ 시스템 에러:', error);
      return { data: null, error: { message: '알 수 없는 오류가 발생했습니다.' } };
    }
  },

  async guestLogin() {
    try {
      const { data: resultData, error: rpcError } = await supabaseClient.issueAIGuestSession();

      if (rpcError || !resultData?.success || !resultData?.session_token) {
        return {
          data: null,
          error: {
            message: getGuestLoginFailureMessage(rpcError, resultData),
            code: rpcError?.code || resultData?.code || 'GUEST_SESSION_FAILED',
          },
        };
      }

      const guestUser = resultData.guest || { id: 'guest', nickname: '게스트', isGuest: true, current_stamps: 0, visit_count: 0 };
      const savedGuest = await saveAuthenticatedCustomer({
        customer: guestUser,
        sessionToken: resultData.session_token,
        sessionType: 'ai_guest_session',
      });

      return { data: savedGuest, error: null };
    } catch (error) {
      console.error('Guest Login Error:', error);
      return { data: null, error: { message: '게스트 로그인 중 오류가 발생했습니다.' } };
    }
  },

};
