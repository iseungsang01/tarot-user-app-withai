import { supabase } from './supabase';

/**
 * 고객 서비스
 * 고객 정보 조회 및 업데이트
 */
export const customerService = {
  /**
   * 고객 정보 조회
   * @param {number} customerId - 고객 ID
   * @returns {object} { data, error }
   */
  async getCustomer(customerId) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .is('deleted_at', null)
      .single();

    return { data, error };
  },

  /**
   * 전화번호로 고객 조회
   * @param {string} phoneNumber - 전화번호 (010-1234-5678)
   * @returns {object} { data, error }
   */
  async getCustomerByPhone(phoneNumber) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('phone_number', phoneNumber)
      .is('deleted_at', null)
      .single();

    return { data, error };
  },

  /**
   * 고객 정보 업데이트
   * @param {number} customerId - 고객 ID
   * @param {object} updates - 수정할 필드들
   * @returns {object} { data, error }
   */
  async updateCustomer(customerId, updates) {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId)
      .is('deleted_at', null)
      .select()
      .single();

    return { data, error };
  },

  /**
   * 고객 탈퇴 (Soft Delete - RPC 함수 사용)
   * ✅ RLS 우회를 위해 SQL 함수 사용
   * @param {string} customerId - 고객 ID (UUID)
   * @returns {object} { success, error }
   */
  async deleteCustomer(customerId) {
    try {
      console.log('🗑️ [customerService] 탈퇴 시작:', customerId);
      
      // RPC 함수 호출로 RLS 우회
      const { data, error } = await supabase
        .rpc('soft_delete_customer', {
          customer_uuid: customerId
        });

      if (error) {
        console.error('❌ [customerService] RPC 오류:', error);
        return { success: false, error };
      }

      if (data === false) {
        console.error('❌ [customerService] 탈퇴 실패: 이미 탈퇴되었거나 존재하지 않는 계정');
        return { 
          success: false, 
          error: { message: '이미 탈퇴되었거나 존재하지 않는 계정입니다.' }
        };
      }

      console.log('✅ [customerService] 탈퇴 성공');
      return { success: true, error: null };
    } catch (error) {
      console.error('❌ [customerService] 탈퇴 오류:', error);
      return { success: false, error };
    }
  },
};