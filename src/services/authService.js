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

const normalizePhone = (phoneNumber = '') => phoneNumber.replace(/\D/g, '');

const buildAuthEmailFromPhone = (phoneNumber = '') => {
  const normalizedPhone = normalizePhone(phoneNumber);
  return normalizedPhone ? `${normalizedPhone}@phone.local` : '';
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
      const guard = await getLoginGuard();
      const normalizedPhone = phoneNumber.trim();
      const authEmail = buildAuthEmailFromPhone(normalizedPhone);

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (signInError) {
        const clientFingerprint = `${normalizedPhone}::${Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'}`;
        const { data: resultData, error: rpcError } = await loginCustomerRpc({
          phone: normalizedPhone,
          password,
          clientFingerprint,
        });

        if (rpcError) {
          console.error('❌ 로그인 진단 RPC 에러:', rpcError);
          return { data: null, error: { message: '서버 연결 중 오류가 발생했습니다.' } };
        }

        const failedAttempts = (guard.failedAttempts || 0) + 1;
        const serverLockUntil = resultData?.lock_expires_at ? new Date(resultData.lock_expires_at).getTime() : 0;
        const lockUntil = serverLockUntil || (failedAttempts >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0);
        await saveLoginGuard({ failedAttempts, lockUntil });

        if (resultData?.reason === 'ACCOUNT_NOT_FOUND') {
          return { data: null, error: { message: '가입되지 않은 계정입니다. 회원가입 후 이용해주세요.' } };
        }

        if (resultData?.reason === 'INVALID_PASSWORD') {
          return {
            data: null,
            error: {
              message: '비밀번호가 일치하지 않습니다.',
              lockedUntil: serverLockUntil || null,
            },
          };
        }

        console.error('❌ 세션 수립 실패:', signInError);
        return {
          data: null,
          error: {
            ...normalizeAuthError(signInError, '로그인 세션을 만들지 못했습니다. 다시 시도해주세요.'),
            code: 'AUTH_SESSION_FAILED',
          },
        };
      }

      const realUUID = signInData?.user?.id;
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
      const normalizedPhone = phoneNumber.trim();
      const authEmail = buildAuthEmailFromPhone(normalizedPhone);

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: authEmail,
        password,
      });

      if (signUpError) {
        console.error('❌ Auth 회원가입 에러:', signUpError);
        return { data: null, error: normalizeAuthError(signUpError, '회원가입에 실패했습니다.') };
      }

      const authUserId = signUpData?.user?.id;
      if (!authUserId) {
        return { data: null, error: { message: '인증 계정 생성에 실패했습니다.' } };
      }

      const { data: resultData, error: rpcError } = await supabaseClient.registerCustomer({
        p_phone: normalizedPhone,
        p_password: password,
        p_nickname: nickname,
        p_auth_user_id: authUserId,
        p_auth_email: authEmail,
      });

      if (rpcError) {
        console.error('❌ RPC 에러:', rpcError);
        return { data: null, error: { message: '회원 프로필 생성 중 오류가 발생했습니다.' } };
      }

      if (!resultData || resultData.success === false) {
        return {
          data: null,
          error: { message: resultData?.message || '회원가입에 실패했습니다.' },
        };
      }

      const customerData = await this.refreshCustomer(authUserId);
      if (!customerData) {
        return { data: null, error: { message: '회원가입은 완료되었지만 프로필을 불러오지 못했습니다.' } };
      }

      await resetLoginGuard();
      return { data: customerData, error: null };
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
