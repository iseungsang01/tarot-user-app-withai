import { ensureAuthenticatedSession, supabase, withAuthErrorHandling } from './supabase';

const requireSession = async () => {
  const state = await ensureAuthenticatedSession();
  return state.ok ? null : state.error;
};

/**
 * 고객 서비스
 * 고객 정보 조회 및 업데이트
 */
export const customerService = {
  async getCustomer(customerId) {
    const authError = await requireSession();
    if (authError) return { data: null, error: authError };

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .is('deleted_at', null)
      .single();

    return { data, error: withAuthErrorHandling(error, authError.message) };
  },

  async getCustomerByPhone(phoneNumber) {
    const authError = await requireSession();
    if (authError) return { data: null, error: authError };

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('phone_number', phoneNumber)
      .is('deleted_at', null)
      .single();

    return { data, error: withAuthErrorHandling(error, authError.message) };
  },

  async updateCustomer(customerId, updates) {
    const authError = await requireSession();
    if (authError) return { data: null, error: authError };

    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId)
      .is('deleted_at', null)
      .select()
      .single();

    return { data, error: withAuthErrorHandling(error, authError.message) };
  },

  async deleteCustomer(customerId) {
    try {
      const authError = await requireSession();
      if (authError) return { success: false, error: authError };

      const { data, error } = await supabase
        .rpc('soft_delete_customer', {
          customer_uuid: customerId,
        });

      if (error) {
        return { success: false, error: withAuthErrorHandling(error, authError.message) };
      }

      if (data === false) {
        return {
          success: false,
          error: { message: '이미 탈퇴되었거나 존재하지 않는 계정입니다.' },
        };
      }

      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: withAuthErrorHandling(error, '인증이 만료되었습니다. 다시 로그인해주세요.') };
    }
  },
};
