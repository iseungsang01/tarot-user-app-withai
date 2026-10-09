import { supabase, withAuthErrorHandling } from './supabase';

const REDEEM_COUPON_FUNCTION = 'redeem-coupon';

// 모든 RPC 는 여기를 지난다. 실패는 SQLSTATE(error.code) + reason(error.message) 이고,
// 세션 만료·제한 세션이면 전역 핸들러로 넘긴다(db-redesign §2-1).
const rpc = async (name, params) => {
  const { data, error } = await supabase.rpc(name, params);
  return { data, error: error ? withAuthErrorHandling(error) : null };
};

// Edge Function 은 실패를 { code } 와 비-2xx 로 돌려준다. supabase-js 가 감싼 응답에서
// 본문을 꺼내 RPC 와 같은 모양(error.reason)으로 맞춘다.
export const readFunctionError = async (error) => {
  const response = error?.context;
  let payload = null;
  if (response && typeof response.clone === 'function') {
    try {
      payload = await response.clone().json();
    } catch {
      payload = null;
    }
  }

  const detailed = new Error(payload?.code || error?.message || 'Edge function request failed.');
  detailed.name = error?.name || 'FunctionsHttpError';
  detailed.code = payload?.code || error?.code;
  detailed.reason = payload?.code || null;
  detailed.status = response?.status;
  return withAuthErrorHandling(detailed);
};

export const supabaseClient = {
  loginCustomer: (payload) => rpc('login_customer', payload),
  registerCustomer: (payload) => rpc('register_customer', payload),
  logout: (payload) => rpc('logout', payload),
  issueGuestSession: () => rpc('issue_guest_session'),

  getMyProfile: (payload) => rpc('get_my_profile', payload),
  updateMyPassword: (payload) => rpc('update_my_password', payload),
  deleteMyAccount: (payload) => rpc('delete_my_account', payload),

  getMyVisits: (payload) => rpc('get_my_visits', payload),
  getMyVisit: (payload) => rpc('get_my_visit', payload),
  hideMyVisit: (payload) => rpc('hide_my_visit', payload),

  getMyCoupons: (payload) => rpc('get_my_coupons', payload),

  // 쿠폰 사용은 관리자 비밀번호를 시크릿과 대조해야 해서 Edge Function 을 거친다.
  async redeemCoupon(body) {
    const { error } = await supabase.functions.invoke(REDEEM_COUPON_FUNCTION, { body });
    return { error: error ? await readFunctionError(error) : null };
  },

  getMyVoteResponses: (payload) => rpc('get_my_vote_responses', payload),
  submitVoteResponse: (payload) => rpc('submit_vote_response', payload),
  cancelVoteResponse: (payload) => rpc('cancel_vote_response', payload),
  getVoteSummary: (payload) => rpc('get_vote_summary', payload),

  submitBugReport: (payload) => rpc('submit_bug_report', payload),
  getMyBugReports: (payload) => rpc('get_my_bug_reports', payload),
};
