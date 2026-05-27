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

  signOutAuthSession() {
    return supabase.auth.signOut({ scope: 'local' });
  },

  updateMyNickname(payload) {
    return supabase.rpc('update_my_nickname', payload);
  },

  deleteMyAccount(payload) {
    return supabase.rpc('delete_my_account', payload);
  },

  getCustomerById(customerId) {
    return supabase.from('customers').select('*').eq('id', customerId).maybeSingle();
  },

  getVisits(customerId) {
    return supabase
      .from('visit_history')
      .select('id, customer_id, visit_date')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .order('visit_date', { ascending: false });
  },

  updateVisit(visitId, payload) {
    return supabase.from('visit_history').update(payload).eq('id', visitId).select().single();
  },

  createVisit(payload) {
    return supabase.from('visit_history').insert(payload).select().single();
  },

  getVisit(visitId) {
    return supabase
      .from('visit_history')
      .select('id, customer_id, visit_date')
      .eq('id', visitId)
      .eq('is_deleted', false)
      .single();
  },

  softDeleteVisit(visitId) {
    return supabase.from('visit_history').update({ is_deleted: true }).eq('id', visitId);
  },

  getCustomerStats(customerId) {
    return supabase.from('customers').select('current_stamps, visit_count').eq('id', customerId).single();
  },

  invokeAIProxy(body) {
    return supabase.functions.invoke('ai-proxy', { body });
  },
};
