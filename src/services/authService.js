import { supabaseClient } from './supabaseClient';
import { ensureAuthenticatedSession, normalizeAuthError, supabase } from './supabase';
import { storage } from '../utils/storage';

const CUSTOMER_KEY = 'tarot_customer';

const LOGIN_GUARD_KEY = 'auth_login_guard';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

const defaultLoginGuard = { failedAttempts: 0, lockUntil: 0 };

const getLoginGuard = async () => (await storage.get(LOGIN_GUARD_KEY)) || { ...defaultLoginGuard };
const saveLoginGuard = async (guard) => storage.save(LOGIN_GUARD_KEY, guard);
const resetLoginGuard = async () => storage.remove(LOGIN_GUARD_KEY);

const buildLoginIdentifiers = (phoneNumber, payload) => {
  const normalizedPhone = phoneNumber?.trim() || '';
  const fakeEmail = `${normalizedPhone.replace(/\D/g, '')}@tarot-app.com`;
  
  const candidates = [
    payload?.auth_email,
    payload?.email,
    payload?.identifier,
    normalizedPhone,
    fakeEmail,
  ].filter(Boolean);

  return [...new Set(candidates)];
};

const fetchCustomerProfile = async (customerId) => {
  if (!customerId) return null;

  try {
    const { data, error } = await supabaseClient.getCustomerById(customerId);
    if (error || !data) return null;

    await storage.save(CUSTOMER_KEY, data);
    return data;
  } catch {
    return null;
  }
};

const establishSupabaseSession = async ({ phoneNumber, password, rpcPayload }) => {
  // 이미 활성화된 세션이 있는지 먼저 확인
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session?.access_token) {
    return { ok: true, error: null };
  }

  const accessToken = rpcPayload?.access_token;
  const refreshToken = rpcPayload?.refresh_token;

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) {
      console.error('❌ 세션 복구 에러:', error);
      return { ok: false, error: normalizeAuthError(error, '로그인 세션을 복구하지 못했습니다. 다시 로그인해주세요.') };
    }
    return { ok: true, error: null };
  }

  const identifiers = buildLoginIdentifiers(phoneNumber, rpcPayload);
  let lastAuthError = null;

  for (const identifier of identifiers) {
    const { error } = await supabase.auth.signInWithPassword({ email: identifier, password });
    if (!error) return { ok: true, error: null };
    lastAuthError = error;
  }

  console.error('❌ Supabase Auth 로그인 실패 (signInWithPassword):', lastAuthError);

  return {
    ok: false,
    error: {
      message: '로그인에는 성공했지만 인증 세션을 만들지 못했습니다. 다시 로그인해주세요.',
      code: 'AUTH_SESSION_REQUIRED',
      requiresReLogin: true,
    },
  };
};

const loginCustomerRpc = async ({ phone, password, clientFingerprint }) => {
  const primaryPayload = {
    p_phone: phone,
    p_password: password,
    p_client_fingerprint: clientFingerprint,
  };

  const primaryResult = await supabaseClient.loginCustomer(primaryPayload);
  if (!primaryResult.error) return primaryResult;

  const isFingerprintSignatureMismatch =
    primaryResult.error?.code === 'PGRST202'
    && primaryResult.error?.message?.includes('public.login_customer')
    && primaryResult.error?.details?.includes('p_client_fingerprint');

  if (!isFingerprintSignatureMismatch) return primaryResult;

  return supabaseClient.loginCustomer({
    p_phone: phone,
    p_password: password,
  });
};

export const authService = {
  async login(phoneNumber, password) {
    try {
      const paddedPassword = password.length < 6 ? password.padEnd(6, '0') : password;
      const guard = await getLoginGuard();
      const clientFingerprint = `${phoneNumber.trim()}::${Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'}`;

      const { data: resultData, error: rpcError } = await loginCustomerRpc({
        phone: phoneNumber.trim(),
        password: paddedPassword,
        clientFingerprint,
      });

      if (rpcError) {
        console.error('❌ RPC 에러:', rpcError);
        return { data: null, error: { message: '서버 연결 중 오류가 발생했습니다.' } };
      }

      if (!resultData || resultData.success === false) {
        const failedAttempts = (guard.failedAttempts || 0) + 1;
        const serverLockUntil = resultData?.lock_expires_at ? new Date(resultData.lock_expires_at).getTime() : 0;
        const lockUntil = serverLockUntil || (failedAttempts >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0);

        await saveLoginGuard({ failedAttempts, lockUntil });

        return {
          data: null,
          error: {
            message: resultData?.message || '전화번호 또는 비밀번호가 일치하지 않습니다.',
            lockedUntil: serverLockUntil || null,
          },
        };
      }

      const sessionResult = await establishSupabaseSession({ phoneNumber, password: paddedPassword, rpcPayload: resultData });
      if (!sessionResult.ok) {
        return { data: null, error: sessionResult.error };
      }

      const realUUID = resultData.id;
      if (!realUUID) return { data: null, error: { message: '로그인 데이터 오류' } };

      const customerData = await this.refreshCustomer(realUUID);

      if (!customerData) {
        const missingSession = await ensureAuthenticatedSession();
        return {
          data: null,
          error: missingSession.ok
            ? { message: '회원 정보를 불러올 수 없습니다.' }
            : normalizeAuthError(null, '인증이 만료되었습니다. 다시 로그인해주세요.'),
        };
      }

      await resetLoginGuard();
      return { data: customerData, error: null };
    } catch (error) {
      console.error('❌ 시스템 에러:', error);
      return { data: null, error: { message: '알 수 없는 오류가 발생했습니다.' } };
    }
  },

  async logout() {
    await supabase.auth.signOut().catch(() => null);
    await storage.remove(CUSTOMER_KEY);
  },

  async getStoredCustomer() {
    try {
      const customer = await storage.get(CUSTOMER_KEY);
      if (!customer) return null;

      const sessionStatus = await ensureAuthenticatedSession();
      if (!sessionStatus.ok) {
        await this.logout();
        return null;
      }

      return this.refreshCustomer(customer.id);
    } catch {
      return null;
    }
  },

  async refreshCustomer(customerId) {
    if (!customerId) return null;

    try {
      // .maybeSingle()을 사용하여 데이터가 없어도 에러가 나지 않게 처리
      const { data, error } = await supabaseClient.getCustomerById(customerId);
      const sessionStatus = await ensureAuthenticatedSession();
      if (!sessionStatus.ok) return null;

      if (error) {
        console.error('❌ 정보 갱신 에러:', error.message);
        return null;
      }

      if (!data) {
        await this.logout();
        return null;
      }

      await storage.save(CUSTOMER_KEY, data);
      return data;
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
      const paddedPassword = password.length < 6 ? password.padEnd(6, '0') : password;
      const normalizedPhone = phoneNumber.trim();
      const fakeEmail = `${normalizedPhone.replace(/\D/g, '')}@tarot-app.com`;

      // 1. Supabase Auth (auth.users) 회원가입으로 세션 생성 기반 마련
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: fakeEmail,
        password: paddedPassword,
      });

      if (authError) {
        console.error('❌ Auth API 에러:', authError);
        return { data: null, error: { message: authError.message || '인증 서버(Auth) 회원가입에 실패했습니다.' } };
      }

      const newUserId = authData?.user?.id;
      if (!newUserId) {
        return { data: null, error: { message: '인증 사용자 ID를 가져오지 못했습니다. 확인 이메일 발송이 켜져있을 수 있습니다.' } };
      }

      // 2. 고객 DB(public.customers) 가입
      const { data: resultData, error: rpcError } = await supabaseClient.registerCustomer({
        p_id: newUserId,
        p_phone: normalizedPhone,
        p_password: paddedPassword,
        p_nickname: nickname,
      });

      if (rpcError) {
        console.error('❌ RPC 에러:', rpcError);
        return { data: null, error: { message: '서버 연결 중 오류가 발생했습니다.' } };
      }

      if (!resultData || resultData.success === false) {
        return {
          data: null,
          error: { message: resultData?.message || '회원가입에 실패했습니다.' },
        };
      }

      // 회원가입 직후에도 동일한 세션 경로 사용
      const loginResult = await this.login(normalizedPhone, password); // We keep original password here because login() will pad it again
      if (loginResult.error) return { data: null, error: loginResult.error };

      return { data: loginResult.data, error: null };
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
