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
 * 투표 서비스
 * 투표 목록 조회, 투표하기, 결과 조회
 */
export const voteService = {
  /**
   * 활성화된 투표 목록 조회
   * @returns {object} { data, error }
   */
  async getVotes() {
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    return { data, error };
  },

  /**
   * 특정 투표 조회
   * @param {number} voteId - 투표 ID
   * @returns {object} { data, error }
   */
  async getVote(voteId) {
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('id', voteId)
      .single();

    return { data, error };
  },

  /**
   * 내 투표 기록 조회
   * @param {number} voteId - 투표 ID
   * @param {number} customerId - 고객 ID
   * @returns {object} { data, error }
   */
  async getMyVote(voteId, customerId) {
    if (customerId === 'guest') return { data: null, error: null };
    try {
      const token = await requireCustomerSessionToken();
      const { data, error } = await supabaseClient.getMyVoteResponse({
        p_session_token: token,
        p_vote_id: voteId,
      });

      return { data: data?.id ? data : null, error };
    } catch (error) {
      console.error('Get my vote error:', error);
      return { data: null, error };
    }
  },

  /**
   * 내 모든 투표 참여 기록 조회 (최적화용)
   * @param {number} customerId - 고객 ID
   * @returns {object} { data: Object<voteId, response>, error }
   */
  async getMyAllResponses(customerId) {
    if (customerId === 'guest') return { data: {}, error: null };
    try {
      const token = await requireCustomerSessionToken();
      const { data, error } = await supabaseClient.getMyVoteResponses({
        p_session_token: token,
      });

      if (error) throw error;

      // vote_id를 키로 하는 맵 생성
      const responseMap = {};
      (data || []).forEach(item => {
        responseMap[item.vote_id] = item;
      });

      return { data: responseMap, error: null };
    } catch (error) {
      console.error('Get all my responses error:', error);
      return { data: {}, error };
    }
  },

  /**
   * 투표하기 또는 수정하기
   * @param {number} voteId - 투표 ID
   * @param {number} customerId - 고객 ID
   * @param {array} selectedOptions - 선택한 옵션 ID 배열
   * @param {number} existingVoteId - 기존 투표 ID (수정 시)
   * @returns {object} { data, error }
   */
  async submitVote(voteId, customerId, selectedOptions, existingVoteId = null) {
    if (customerId === 'guest') return { data: null, error: 'Guest cannot vote' };
    try {
      const token = await requireCustomerSessionToken();
      const { data, error } = await supabaseClient.submitVoteResponse({
        p_session_token: token,
        p_vote_id: voteId,
        p_selected_options: selectedOptions,
        p_response_id: existingVoteId,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Submit vote error:', error);
      return { data: null, error };
    }
  },

  /**
   * 투표 결과 조회
   * @param {number} voteId - 투표 ID
   * @returns {object} { results, error }
   */
  async getVoteResults(voteId) {
    try {
      const { data, error } = await supabaseClient.getVoteSummary({ p_vote_id: voteId });

      if (error) throw error;

      return { data: { results: data?.results || {} }, error: null };

    } catch (error) {
      console.error('Get vote results error:', error);
      return { data: { results: {} }, error };
    }
  },

  /**
   * 투표 총 참여자 수 조회
   * @param {number} voteId - 투표 ID
   * @returns {object} { count, error }
   */
  async getVoteParticipants(voteId) {
    try {
      const { data, error } = await supabaseClient.getVoteSummary({ p_vote_id: voteId });

      if (error) throw error;
      return { data: { count: data?.count || 0 }, error: null };
    } catch (error) {
      console.error('Get vote participants error:', error);
      return { data: { count: 0 }, error };
    }
  },

  /**
   * 투표 취소 (삭제)
   * @param {number} voteId - 투표 ID
   * @param {string} customerId - 고객 ID (UUID)
   * @returns {object} { data, error }
   */
  async cancelVote(voteId, customerId) {
    if (customerId === 'guest') return { data: null, error: 'Guest cannot cancel vote' };
    try {
      const token = await requireCustomerSessionToken();
      const { data, error } = await supabaseClient.cancelVoteResponse({
        p_session_token: token,
        p_vote_id: voteId,
      });

      if (error) throw error;
      return { data: data === true, error: null };
    } catch (error) {
      console.error('Cancel vote error:', error);
      return { data: null, error };
    }
  },
};