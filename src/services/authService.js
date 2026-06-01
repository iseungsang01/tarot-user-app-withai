import { supabaseClient } from './supabaseClient';
import { storage } from '../utils/storage';
import { normalizeCustomerPassword } from '../utils/password';

const CUSTOMER_KEY = 'tarot_customer';
const CUSTOMER_SESSION_KEY = 'tarot_customer_session';

const LOGIN_GUARD_KEY = 'auth_login_guard';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

const defaultLoginGuard = { failedAttempts: 0, lockUntil: 0 };

const getLoginGuard = async () => (await storage.get(LOGIN_GUARD_KEY)) || { ...defaultLoginGuard };
const saveLoginGuard = async (guard) => storage.save(LOGIN_GUARD_KEY, guard);
const resetLoginGuard = async () => storage.remove(LOGIN_GUARD_KEY);

const normalizeCustomer = (payload) => payload?.customer || payload?.profile || payload;

const saveAuthenticatedCustomer = async ({ customer, sessionToken }) => {
  if (!customer || !sessionToken) return null;

  await storage.save(CUSTOMER_SESSION_KEY, {
    token: sessionToken,
    customerId: customer.id,
    savedAt: new Date().toISOString(),
  });
  await storage.save(CUSTOMER_KEY, customer);

  return customer;
};

const getStoredSession = async () => storage.get(CUSTOMER_SESSION_KEY);

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

const getFailureMessage = (resultData) => {
  if (resultData?.reason === 'INVALID_PASSWORD') return '비밀번호가 일치하지 않습니다.';
  if (resultData?.reason === 'CUSTOMER_NOT_FOUND') return '가입된 회원 정보를 찾을 수 없습니다.';
  return resultData?.message || '전화번호 또는 비밀번호가 일치하지 않습니다.';
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

  return message;
};

const getRpcFailureMessage = (rpcError) => {
  if (rpcError?.code === '22023' && rpcError?.message?.toLowerCase?.().includes('invalid salt')) {
    return '계정 비밀번호 저장 형식에 문제가 있습니다. 매장에 문의해주세요.';
  }

  return '서버 연결 중 오류가 발생했습니다.';
};

export const authService = {
  async login(phoneNumber, password) {
    try {
      const paddedPassword = normalizeCustomerPassword(password);
      const guard = await getLoginGuard();
      const clientFingerprint = `${phoneNumber.trim()}::${Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'}`;

      const { data: resultData, error: rpcError } = await supabaseClient.loginCustomer({
        p_phone: phoneNumber.trim(),
        p_password: paddedPassword,
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

    if (session?.token) {
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

  async updateNickname(customerId, newNickname) {
    try {
      const { data, error } = await supabaseClient.updateMyNickname({
        p_id: customerId,
        p_new_nickname: newNickname,
      });

      if (error) throw error;
      return { success: data };
    } catch (error) {
      console.error('Update Nickname Error:', error);
      return { success: false, message: error.message };
    }
  },

  async register(phoneNumber, password, nickname = '') {
    try {
      const paddedPassword = normalizeCustomerPassword(password);
      const normalizedPhone = phoneNumber.trim();

      const { data: resultData, error: rpcError } = await supabaseClient.registerCustomer({
        p_phone: normalizedPhone,
        p_password: paddedPassword,
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

  async deleteAccount(customerId) {
    try {
      const { data, error } = await supabaseClient.deleteMyAccount({ p_id: customerId });
      if (error) throw error;

      if (data) await this.logout();
      return { success: data };
    } catch (error) {
      console.error('Delete Account Error:', error);
      return { success: false, message: error.message };
    }
  },
};
