import { supabase } from './supabase';
import { supabaseClient } from './supabaseClient';
import { storage } from '../utils/storage';

const CUSTOMER_SESSION_KEY = 'tarot_customer_session';

const getCustomerSessionToken = async () => {
  const session = await storage.get(CUSTOMER_SESSION_KEY);
  return session?.token || null;
};

const requireCustomerSessionToken = async () => {
  const token = await getCustomerSessionToken();
  if (!token) {
    const error = new Error('Login is required. Please sign in again.');
    error.code = 'AUTH_REQUIRED';
    error.requiresReLogin = true;
    throw error;
  }
  return token;
};

/**
 * 쿠폰 서비스
 * 쿠폰 조회, 사용, 발급
 */
export const couponService = {
  /**
   * 고객의 쿠폰 목록 조회 (사용하지 않은 쿠폰만)
   * @param {string} customerId - 고객 ID (UUID)
   * @returns {object} { data, error }
   */
  async getCoupons(customerId) {
    if (customerId === 'guest') return { data: [], error: null };
    try {
      const token = await requireCustomerSessionToken();
      const { data, error } = await supabaseClient.getMyCoupons({
        p_session_token: token,
        p_valid_only: false,
      });

      if (error) {
        console.error('Fetch coupons error:', error);
        throw error;
      }
      return { data, error: null };
    } catch (error) {
      console.error('Get coupons error:', error);
      return { data: [], error };
    }
  },

  /**
   * 고객의 쿠폰 개수 조회 (사용하지 않은 쿠폰만)
   * @param {string} customerId - 고객 ID (UUID)
   * @returns {object} { count, error }
   */
  async getCouponCount(customerId) {
    if (customerId === 'guest') return { count: 0, error: null };
    try {

      const token = await requireCustomerSessionToken();
      const { data: count, error } = await supabaseClient.getMyCouponCount({
        p_session_token: token,
        p_valid_only: false,
      });

      if (error) {
        console.error('Count coupons error:', error);
        throw error;
      }


      return { count: count || 0, error: null };
    } catch (error) {
      console.error('Get coupon count error:', error);
      return { count: 0, error };
    }
  },

  /**
   * 쿠폰 사용
   * @param {number} couponId - 쿠폰 ID
   * @returns {object} { error }
   */
  async useCoupon(couponId, adminPassword) {
    try {
      if (!adminPassword?.trim()) {
        const error = new Error('Admin password is required to use a coupon.');
        error.code = 'ADMIN_PASSWORD_REQUIRED';
        throw error;
      }

      const token = await requireCustomerSessionToken();
      const { data, error } = await supabaseClient.redeemCoupon({
        p_coupon_id: couponId,
        p_admin_password: adminPassword,
        p_session_token: token,
      });

      if (error) {
        console.error('Use coupon error:', error);
        throw error;
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (result?.success !== true || result?.message !== 'ok') {
        const message = result?.message || 'coupon_redemption_failed';
        const useError = new Error(message);
        useError.code = message;
        throw useError;
      }

      return { error: null, message: result.message };
    } catch (error) {
      if (error?.code !== 'ADMIN_PASSWORD_REQUIRED') {
        console.error('Use coupon error:', error);
      }
      return { error };
    }
  },

  /**
   * 쿠폰 발급 (관리자용)
   * @param {object} couponData - 쿠폰 데이터
   * @returns {object} { data, error }
   */
  async issueCoupon(couponData) {
    try {
      // coupon_code가 없으면 자동 생성
      if (!couponData.coupon_code) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        couponData.coupon_code = `STAMP-${timestamp}-${random}`;
      }

      const { data, error } = await supabase
        .from('coupon_history')
        .insert(couponData)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Issue coupon error:', error);
      return { data: null, error };
    }
  },

  /**
   * 만료된 쿠폰 삭제 (관리자용)
   * @returns {object} { error }
   */
  async deleteExpiredCoupons() {
    try {
      const { error } = await supabase
        .from('coupon_history')
        .delete()
        .lt('valid_until', new Date().toISOString())
        .eq('is_used', false);

      return { error };
    } catch (error) {
      console.error('Delete expired coupons error:', error);
      return { error };
    }
  },

  /**
   * 유효한 쿠폰만 조회 (만료되지 않고 사용하지 않은 쿠폰)
   * @param {string} customerId - 고객 ID (UUID)
   * @returns {object} { data, error }
   */
  async getValidCoupons(customerId) {
    if (customerId === 'guest') return { data: [], error: null };
    try {
      const token = await requireCustomerSessionToken();
      const { data, error } = await supabaseClient.getMyCoupons({
        p_session_token: token,
        p_valid_only: true,
      });

      return { data, error };
    } catch (error) {
      console.error('Get valid coupons error:', error);
      return { data: [], error };
    }
  },

  /**
   * 유효한 쿠폰 개수 조회 (만료되지 않고 사용하지 않은 쿠폰만)
   * @param {string} customerId - 고객 ID (UUID)
   * @returns {object} { count, error }
   */
  async getValidCouponCount(customerId, signal = null) {
    if (customerId === 'guest') return { count: 0, error: null };
    try {
      const token = await requireCustomerSessionToken();
      const { data: count, error } = await supabaseClient.getMyCouponCount({
        p_session_token: token,
        p_valid_only: true,
      }, { abortSignal: signal });

      return { count: count || 0, error };
    } catch (error) {
      console.error('Get valid coupon count error:', error);
      return { count: 0, error };
    }
  },
};
