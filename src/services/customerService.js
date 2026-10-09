import { ensureAuthenticatedSession } from './supabase';
import { supabaseClient } from './supabaseClient';

// update_my_password · delete_my_account 공통 실패 문구(db-redesign §4).
// 비밀번호 재확인 한도(시간당 10회)는 두 함수가 함께 쓴다.
const toAccountError = (error, fallback) => {
  if (error?.isAuthError) return error;
  if (error?.code === '28P01') {
    return { code: 'invalid_password', message: '현재 비밀번호가 일치하지 않습니다. 여러 번 틀리면 1시간 동안 확인이 막힙니다.' };
  }
  if (error?.code === 'P0001') {
    return { code: 'rate_limited', message: '비밀번호 확인 시도가 너무 많습니다. 1시간 후 다시 시도해주세요.' };
  }
  if (error?.message === 'WEAK_PASSWORD') {
    return { code: 'invalid_new_password', message: '새 비밀번호는 6자 이상이어야 하고 123456 은 쓸 수 없습니다.' };
  }
  return { code: error?.code, message: fallback };
};

export const customerService = {
  async updateMyPassword(currentPassword, newPassword, reason = 'settings_change') {
    try {
      const state = await ensureAuthenticatedSession();
      if (!state.ok) return { success: false, error: state.error };

      const { error } = await supabaseClient.updateMyPassword({
        p_session_token: state.session.token,
        current_password: currentPassword,
        new_password: newPassword,
        p_reason: reason,
      });
      if (error) return { success: false, error: toAccountError(error, '비밀번호 변경에 실패했습니다.') };

      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: toAccountError(error, '비밀번호 변경에 실패했습니다.') };
    }
  },

  async deleteCustomer(inputPassword) {
    try {
      const state = await ensureAuthenticatedSession();
      if (!state.ok) return { success: false, error: state.error };

      const { error } = await supabaseClient.deleteMyAccount({
        p_session_token: state.session.token,
        input_password: inputPassword,
      });
      if (error) return { success: false, error: toAccountError(error, '계정 삭제에 실패했습니다.') };

      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: toAccountError(error, '계정 삭제에 실패했습니다.') };
    }
  },
};
