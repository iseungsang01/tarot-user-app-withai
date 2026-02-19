import { supabase } from './supabase';
import { storage } from '../utils/storage';

const CUSTOMER_KEY = 'tarot_customer';

export const authService = {
  /**
   * 로그인 (RPC 방식 + 객체 응답 처리 수정됨)
   */
  async login(phoneNumber, password) {
    try {
      const normalizedPhone = phoneNumber.trim();

      const { data: resultData, error: rpcError } = await supabase
        .rpc('login_customer', {
          p_phone: normalizedPhone,
          p_password: password
        });

      if (rpcError) {
        console.error('❌ RPC 에러:', rpcError);
        return { data: null, error: { message: '서버 연결 중 오류가 발생했습니다.' } };
      }

      if (!resultData || resultData.success === false) {
        return {
          data: null,
          error: { message: resultData?.message || '전화번호 또는 비밀번호가 일치하지 않습니다.' }
        };
      }

      const realUUID = resultData.id;

      if (!realUUID) {
        return { data: null, error: { message: '로그인 데이터 오류' } };
      }

      const customerData = await this.refreshCustomer(realUUID);

      if (!customerData) {
        return { data: null, error: { message: '회원 정보를 불러올 수 없습니다.' } };
      }

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
      if (customer) {
        return await this.refreshCustomer(customer.id);
      }
      return null;
    } catch (error) {
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
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .maybeSingle();

      if (error) {
        console.error('❌ 정보 갱신 에러:', error.message);
        return null;
      }

      if (data) {
        await storage.save(CUSTOMER_KEY, data);
        return data;
      } else {
        await this.logout();
        return null;
      }
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
      const { data, error } = await supabase
        .rpc('update_my_nickname', {
          p_id: customerId,
          p_new_nickname: newNickname
        });

      if (error) throw error;
      return { success: data };
    } catch (error) {
      console.error('Update Nickname Error:', error);
      return { success: false, message: error.message };
    }
  },

  /**
   * 회원 탈퇴
   */
  async deleteAccount(customerId) {
    try {
      const { data, error } = await supabase
        .rpc('delete_my_account', {
          p_id: customerId
        });

      if (error) throw error;

      if (data) {
        await this.logout();
      }
      return { success: data };
    } catch (error) {
      console.error('Delete Account Error:', error);
      return { success: false, message: error.message };
    }
  }
};