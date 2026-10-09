import { supabase } from './supabase';
import { supabaseClient } from './supabaseClient';
import { requireCustomerSessionToken } from './customerSession';

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
      // 활성·시작 여부는 RLS 가 거른다(클라이언트 시각을 믿지 않는다).
      .order('created_at', { ascending: false });

    return { data, error };
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
   * @param {array} selectedOptions - 선택한 옵션 인덱스 배열
   * @returns {object} { data: { id, selected_options }, error } — 서버가 (vote_id, customer_id) 로 upsert 한다
   */
  async submitVote(voteId, customerId, selectedOptions) {
    if (customerId === 'guest') return { data: null, error: 'Guest cannot vote' };
    try {
      const token = await requireCustomerSessionToken();
      const { data, error } = await supabaseClient.submitVoteResponse({
        p_session_token: token,
        p_vote_id: voteId,
        p_selected_options: selectedOptions,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Submit vote error:', error);
      return { data: null, error };
    }
  },

  /**
   * 투표 집계 조회 (선택지별 결과 + 총 참여자 수)
   * @param {number} voteId - 투표 ID
   * @returns {object} { data: { results, count }, error }
   */
  async getVoteSummary(voteId) {
    try {
      const { data, error } = await supabaseClient.getVoteSummary({ p_vote_id: voteId });

      if (error) throw error;

      return { data: { results: data?.results || {}, count: data?.count || 0 }, error: null };
    } catch (error) {
      console.error('Get vote summary error:', error);
      return { data: { results: {}, count: 0 }, error };
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
      const { error } = await supabaseClient.cancelVoteResponse({
        p_session_token: token,
        p_vote_id: voteId,
      });

      if (error) throw error;
      return { data: true, error: null };
    } catch (error) {
      console.error('Cancel vote error:', error);
      return { data: null, error };
    }
  },
};