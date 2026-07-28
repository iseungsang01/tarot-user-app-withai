import { supabase } from './supabase';

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

  updateVisit(visitId, payload) {
    return supabase.from('visit_history').update(payload).eq('id', visitId).select().single();
  },

  createVisit(payload) {
    return supabase.from('visit_history').insert(payload).select().single();
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

  redeemCoupon(payload) {
    return supabase.rpc('redeem_coupon', payload);
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
