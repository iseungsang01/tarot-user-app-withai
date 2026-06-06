import { ensureAuthenticatedSession, withAuthErrorHandling } from './supabase';
import { supabaseClient } from './supabaseClient';

const requireSession = async () => {
  const state = await ensureAuthenticatedSession();
  return state.ok ? null : state.error;
};

/**
 * 고객 서비스
 * 고객 정보 조회 및 업데이트
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
    if (!state.ok) return { data: null, error: withAuthErrorHandling(state.error, '?? ???? ???.') };

    const { data, error } = await supabaseClient.getMyProfile({
      p_session_token: state.session.token,
    });

    return { data, error: error ? withAuthErrorHandling(error, '?? ??? ???? ?????. ?? ???? ???.') : null };
  },

  async getCustomerByPhone(_phoneNumber) {
    return {
      data: null,
      error: { message: '?? ???? ?? ??? ??? ??? ???? ????.' },
    };
  },

  async updateCustomer(_customerId, _updates) {
    return {
      data: null,
      error: { message: '?? ?? ?? ??? ??? ??? ???? ????.' },
    };
  },

  async deleteCustomer(_customerId, inputPassword) {
    try {
      const state = await ensureAuthenticatedSession();
      if (!state.ok) return { success: false, error: withAuthErrorHandling(state.error, '다시 로그인해 주세요.') };

      const { data, error } = await supabaseClient.deleteMyAccount({
        p_session_token: state.session.token,
        input_password: inputPassword,
      });

      if (error) {
        return { success: false, error: withAuthErrorHandling(error, '계정 삭제에 실패했습니다. 다시 로그인해 주세요.') };
      }

      if (data === false) {
        return {
          success: false,
          error: { message: '비밀번호가 일치하지 않거나 다시 로그인이 필요합니다.' },
        };
      }

      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: withAuthErrorHandling(error, '다시 로그인해 주세요.') };
    }
  },
};
