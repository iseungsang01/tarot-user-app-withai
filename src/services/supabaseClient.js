import { supabase } from './supabase';

const REDEEM_COUPON_FUNCTION = 'redeem-coupon';

const readFunctionErrorBody = async (error) => {
  const response = error?.context;
  if (!response || typeof response.clone !== 'function') return null;
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
};

export const supabaseClient = {
  loginCustomer(payload) {
    return supabase.rpc('login_customer', payload);
  },

  registerCustomer(payload) {
    return supabase.rpc('register_customer', payload);
  },

  getMyProfile(payload) {
    return supabase.rpc('get_my_profile', payload);
  },

  logoutCustomer(payload) {
    return supabase.rpc('logout_customer', payload);
  },

  issueAIGuestSession() {
    return supabase.rpc('issue_ai_guest_session');
  },

  logoutAIGuestSession(payload) {
    return supabase.rpc('logout_ai_guest_session', payload);
  },

  verifyMyPassword(payload) {
    return supabase.rpc('verify_my_password', payload);
  },

  updateMyPassword(payload) {
    return supabase.rpc('update_my_password', payload);
  },

  deleteMyAccount(payload) {
    return supabase.rpc('delete_my_account', payload);
  },

  getMyVisits(payload) {
    return supabase.rpc('get_my_visits', payload);
  },

  getMyVisit(payload) {
    return supabase.rpc('get_my_visit', payload).single();
  },

  hideMyVisit(payload) {
    return supabase.rpc('hide_my_visit', payload);
  },

  getCustomerStats(payload, options = {}) {
    return supabase.rpc('get_customer_stats', payload, options);
  },

  getMyCoupons(payload) {
    return supabase.rpc('get_my_coupons', payload);
  },

  getMyCouponCount(payload, options = {}) {
    return supabase.rpc('get_my_coupon_count', payload, options);
  },

  // 쿠폰 사용은 RPC 가 아니라 Edge Function 을 거친다.
  // 관리자 비밀번호를 DB(GUC·app_configs)에 두지 않기 위한 것으로,
  // 검증은 redeem-coupon 함수가 시크릿과 대조해서 처리한다.
  // 근거: docs/manager-app-db-issues-round2.md §2 [확정3]
  async redeemCoupon(body) {
    const { data, error } = await supabase.functions.invoke(REDEEM_COUPON_FUNCTION, { body });
    if (!error) return { data, error: null };

    // 함수는 실패도 { success, message } 로 돌려주는데 supabase-js 가 비-2xx 를
    // error 로 감싸 버린다. 본문을 꺼내 호출부가 message 로 분기할 수 있게 되돌린다.
    const payload = await readFunctionErrorBody(error);
    if (payload && typeof payload.message === 'string') return { data: payload, error: null };
    return { data: null, error };
  },

  getMyVoteResponses(payload) {
    return supabase.rpc('get_my_vote_responses', payload);
  },

  getMyVoteResponse(payload) {
    return supabase.rpc('get_my_vote_response', payload);
  },

  submitVoteResponse(payload) {
    return supabase.rpc('submit_vote_response', payload);
  },

  cancelVoteResponse(payload) {
    return supabase.rpc('cancel_vote_response', payload);
  },

  getVoteSummary(payload) {
    return supabase.rpc('get_vote_summary', payload);
  },


  submitBugReport(payload) {
    return supabase.rpc('submit_bug_report', payload);
  },

  getMyBugReports(payload) {
    return supabase.rpc('get_my_bug_reports', payload);
  },
};
