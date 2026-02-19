import { supabase } from './supabase';

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
      const { data, error } = await supabase
        .from('vote_responses')
        .select('*')
        .eq('vote_id', voteId)
        .eq('customer_id', customerId)
        .single();

      // 데이터가 없어도 에러로 처리하지 않음
      if (error && error.code === 'PGRST116') {
        return { data: null, error: null };
      }

      return { data, error };
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
      const { data, error } = await supabase
        .from('vote_responses')
        .select('*')
        .eq('customer_id', customerId);

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
      if (existingVoteId) {
        // 투표 수정
        const { data, error } = await supabase
          .from('vote_responses')
          .update({
            selected_options: selectedOptions,
            voted_at: new Date().toISOString(),
          })
          .eq('id', existingVoteId)
          .select()
          .single();

        if (error) throw error;
        return { data, error: null };
      } else {
        // 새 투표
        const { data, error } = await supabase
          .from('vote_responses')
          .insert({
            vote_id: voteId,
            customer_id: customerId,
            selected_options: selectedOptions,
          })
          .select()
          .single();

        if (error) throw error;
        return { data, error: null };
      }
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
      const { data, error } = await supabase
        .from('vote_responses')
        .select('selected_options')
        .eq('vote_id', voteId);

      if (error) throw error;

      // 각 옵션의 투표 수 집계
      const results = {};
      (data || []).forEach((response) => {
        // 데이터가 배열인지 JSON 문자열인지 확인하여 안전하게 파싱
        let options = response.selected_options;

        // 만약 문자열로 저장되어 있다면 파싱, 아니면 그대로 사용
        if (typeof options === 'string') {
          try { options = JSON.parse(options); } catch (e) { options = []; }
        }
        if (!Array.isArray(options)) options = [];

        options.forEach((optionId) => {
          // 키를 문자열로 통일하여 저장 (숫자 0과 문자 "0" 매칭 문제 방지)
          const key = String(optionId);
          results[key] = (results[key] || 0) + 1;
        });
      });

      return { data: { results }, error: null };

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
      const { count, error } = await supabase
        .from('vote_responses')
        .select('*', { count: 'exact', head: true })
        .eq('vote_id', voteId);

      if (error) throw error;
      return { data: { count: count || 0 }, error: null };
    } catch (error) {
      console.error('Get vote participants error:', error);
      return { count: 0, error };
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
      const { error } = await supabase
        .from('vote_responses')
        .delete()
        .eq('vote_id', voteId)
        .eq('customer_id', customerId);

      if (error) throw error;
      return { data: true, error: null };
    } catch (error) {
      console.error('Cancel vote error:', error);
      return { data: null, error };
    }
  },
};