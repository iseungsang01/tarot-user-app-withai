import { supabaseClient } from './supabaseClient';
import { storage } from '../utils/storage';

const CUSTOMER_KEY = 'tarot_customer';

const LOGIN_GUARD_KEY = 'auth_login_guard';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

const defaultLoginGuard = { failedAttempts: 0, lockUntil: 0 };

const getLoginGuard = async () => (await storage.get(LOGIN_GUARD_KEY)) || { ...defaultLoginGuard };
const saveLoginGuard = async (guard) => storage.save(LOGIN_GUARD_KEY, guard);
const resetLoginGuard = async () => storage.remove(LOGIN_GUARD_KEY);

export const authService = {
  /**
   * 로그인 (RPC 방식 + 객체 응답 처리 수정됨)
   */
  async login(phoneNumber, password) {
    try {
      const guard = await getLoginGuard();
      const clientFingerprint = `${phoneNumber.trim()}::${Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'}`;

      const { data: resultData, error: rpcError } = await supabaseClient.loginCustomer({
        p_phone: phoneNumber.trim(),
        p_password: password,
        p_client_fingerprint: clientFingerprint,
      });

      if (rpcError) {
        console.error('❌ RPC 에러:', rpcError);
        return { data: null, error: { message: '서버 연결 중 오류가 발생했습니다.' } };
      }

      if (!resultData || resultData.success === false) {
        const failedAttempts = (guard.failedAttempts || 0) + 1;
        const serverLockUntil = resultData?.lock_expires_at ? new Date(resultData.lock_expires_at).getTime() : 0;
        const lockUntil = serverLockUntil || (failedAttempts >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0);

        // 클라이언트 가드는 UX 보조(버튼 비활성화) 용도이며, 보안 판단은 서버 응답을 따른다.
        await saveLoginGuard({ failedAttempts, lockUntil });

        return {
          data: null,
          error: {
            message: resultData?.message || '전화번호 또는 비밀번호가 일치하지 않습니다.',
            lockedUntil: serverLockUntil || null,
          },
        };
      }

      const realUUID = resultData.id;
      if (!realUUID) return { data: null, error: { message: '로그인 데이터 오류' } };

      const customerData = await this.refreshCustomer(realUUID);
      if (!customerData) return { data: null, error: { message: '회원 정보를 불러올 수 없습니다.' } };

      await resetLoginGuard();
      return { data: customerData, error: null };
    } catch (error) {
      console.error('❌ 시스템 에러:', error);
      return { data: null, error: { message: '알 수 없는 오류가 발생했습니다.' } };
    }
  },

  /**
   * 로그아웃
   */
  async logout() {
    await storage.remove(CUSTOMER_KEY);
  },

  /**
   * 저장된 고객 정보 조회
   */
  async getStoredCustomer() {
    try {
      const customer = await storage.get(CUSTOMER_KEY);
      return customer ? this.refreshCustomer(customer.id) : null;
    } catch {
      return null;
    }
  },

  /**
   * 고객 정보 새로고침
   */
  async refreshCustomer(customerId) {
    if (!customerId) return null;

    try {
      // .maybeSingle()을 사용하여 데이터가 없어도 에러가 나지 않게 처리
      const { data, error } = await supabaseClient.getCustomerById(customerId);

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

  /**
  * 닉네임 변경
  */
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

  /**
   * 회원가입
   */
  async register(phoneNumber, password, nickname = '') {
    try {
      const { data: resultData, error: rpcError } = await supabaseClient.registerCustomer({
        p_phone: phoneNumber.trim(),
        p_password: password,
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

      return { data: resultData, error: null };
    } catch (error) {
      console.error('❌ 시스템 에러:', error);
      return { data: null, error: { message: '알 수 없는 오류가 발생했습니다.' } };
    }
  },

  /**
   * 회원 탈퇴
   */
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
