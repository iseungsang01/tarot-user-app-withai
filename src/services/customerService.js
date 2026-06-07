import { ensureAuthenticatedSession, withAuthErrorHandling } from './supabase';
import { supabaseClient } from './supabaseClient';

/**
 * Customer service helpers backed by session-token RPCs.
 */
export const customerService = {
  async verifyMyPassword(inputPassword) {
    try {
      const state = await ensureAuthenticatedSession();
      if (!state.ok) return { data: false, error: withAuthErrorHandling(state.error, '다시 로그인해 주세요.') };
      const { data, error } = await supabaseClient.verifyMyPassword({
        p_session_token: state.session.token,
        input_password: inputPassword,
      });
      return { data: data === true, error: error ? withAuthErrorHandling(error, '비밀번호 확인에 실패했습니다. 다시 로그인해 주세요.') : null };
    } catch (error) {
      return { data: false, error: withAuthErrorHandling(error, '다시 로그인해 주세요.') };
    }
  },

  async updateMyPassword(currentPassword, newPassword, reason = 'settings_change') {
    try {
      const state = await ensureAuthenticatedSession();
      if (!state.ok) return { success: false, error: withAuthErrorHandling(state.error, '다시 로그인해 주세요.') };
      const { data, error } = await supabaseClient.updateMyPassword({
        p_session_token: state.session.token,
        current_password: currentPassword,
        new_password: newPassword,
        p_reason: reason,
      });
      return { success: data === true, error: error ? withAuthErrorHandling(error, '비밀번호 변경에 실패했습니다. 다시 로그인해 주세요.') : null };
    } catch (error) {
      return { success: false, error: withAuthErrorHandling(error, '다시 로그인해 주세요.') };
    }
  },

  async getCustomer(_customerId) {
    const state = await ensureAuthenticatedSession();
    if (!state.ok) return { data: null, error: withAuthErrorHandling(state.error, '내 정보를 불러올 수 없습니다.') };
    const { data, error } = await supabaseClient.getMyProfile({ p_session_token: state.session.token });
    return { data, error: error ? withAuthErrorHandling(error, '내 정보를 불러오지 못했습니다. 다시 로그인해 주세요.') : null };
  },

  async getCustomerByPhone(_phoneNumber) {
    return { data: null, error: { message: '전화번호로 고객을 직접 조회하는 기능은 사용자 앱에서 지원하지 않습니다.' } };
  },

  async updateCustomer(_customerId, _updates) {
    return { data: null, error: { message: '고객 정보를 직접 수정하는 기능은 사용자 앱에서 지원하지 않습니다.' } };
  },

  async deleteCustomer(_customerId, inputPassword) {
    try {
      const state = await ensureAuthenticatedSession();
      if (!state.ok) return { success: false, error: withAuthErrorHandling(state.error, '다시 로그인해 주세요.') };
      const { data, error } = await supabaseClient.deleteMyAccount({
        p_session_token: state.session.token,
        input_password: inputPassword,
      });
      if (error) return { success: false, error: withAuthErrorHandling(error, '계정 삭제에 실패했습니다. 다시 로그인해 주세요.') };
      if (data === false) return { success: false, error: { message: '비밀번호가 일치하지 않거나 다시 로그인이 필요합니다.' } };
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: withAuthErrorHandling(error, '다시 로그인해 주세요.') };
    }
  },
};
