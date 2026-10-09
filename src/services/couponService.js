import { supabaseClient } from './supabaseClient';
import { requireCustomerSessionToken } from './customerSession';

const SILENT_COUPON_USE_ERROR_CODES = new Set([
  'ADMIN_PASSWORD_REQUIRED',
  'INVALID_CREDENTIALS',
]);

export const couponService = {
  // [{ id, coupon_code, coupon_type('stamp'|'birthday'), issued_at, valid_until }]
  async getCoupons(customerId) {
    if (customerId === 'guest') return { data: [], error: null };
    try {
      const token = await requireCustomerSessionToken();
      const { data, error } = await supabaseClient.getMyCoupons({
        p_session_token: token,
        p_valid_only: false,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Get coupons error:', error);
      return { data: [], error };
    }
  },

  // 매장 직원이 관리자 비밀번호를 입력해 사용 처리한다. 실패 사유는 error.reason
  // (INVALID_CREDENTIALS · NOT_FOUND · COUPON_USED · COUPON_EXPIRED · RATE_LIMITED 등).
  async useCoupon(couponId, adminPassword) {
    try {
      if (!adminPassword?.trim()) {
        const error = new Error('Admin password is required to use a coupon.');
        error.code = 'ADMIN_PASSWORD_REQUIRED';
        throw error;
      }

      const token = await requireCustomerSessionToken();
      const { error } = await supabaseClient.redeemCoupon({
        couponId,
        adminPassword,
        sessionToken: token,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      if (!SILENT_COUPON_USE_ERROR_CODES.has(error?.code)) {
        console.error('Use coupon error:', error);
      }
      return { error };
    }
  },
};
