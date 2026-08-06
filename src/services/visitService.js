import { supabaseClient } from './supabaseClient';
import { ensureAuthenticatedSession, withAuthErrorHandling } from './supabase';
import { storage } from '../utils/storage';

const requireSession = async () => {
  const session = await ensureAuthenticatedSession();
  return session.ok ? null : session.error;
};



export const visitService = {
  syncLocalVisitFields: async (visitId, updates) => {
    await Promise.all([
      updates.card_image === undefined ? null : (updates.card_image ? storage.saveCardImage(visitId, updates.card_image) : storage.deleteCardImage(visitId)),
      updates.card_review === undefined ? null : (updates.card_review ? storage.saveCardReview(visitId, updates.card_review) : storage.deleteCardReview(visitId)),
      updates.title === undefined ? null : (updates.title ? storage.saveCardTitle(visitId, updates.title) : storage.deleteCardTitle(visitId)),
      updates.ai_insight === undefined ? null : (updates.ai_insight ? storage.saveCardAIInsight(visitId, updates.ai_insight) : storage.deleteCardAIInsight(visitId)),
    ].filter(Boolean));
  },

  async getVisits(customerId) {
    if (customerId === 'guest') return { data: [], error: null };

    try {
      const sessionState = await ensureAuthenticatedSession();
      if (!sessionState.ok) return { data: [], error: sessionState.error };

      const { data, error } = await supabaseClient.getMyVisits({
        p_session_token: sessionState.session.token,
      });

      if (error) throw withAuthErrorHandling(error, sessionState.error?.message);
      return { data, error: null };
    } catch (error) {
      console.error('❌ [visitService] getVisits 오류:', error.message);
      return { data: [], error };
    }
  },

  /**
   * 방문 기록의 로컬 전용 필드(카드 이미지/후기/제목/AI 해석)만 저장한다.
   *
   * visit_history 서버 쓰기 경로는 제거했다. 스탬프 적립은 매장에서 직원이
   * 매니저 앱으로 처리하는 것이 정본이고, 고객이 자기 방문을 직접 생성·수정하는
   * 기능은 로드맵에 없다(매니저 회신 §8). 실제로 visit_history 는 anon 에
   * GRANT 도 RLS 정책도 없어 호출됐다면 42501 로 실패했을 코드였다.
   */
  async updateVisit(visitId, updates) {
    try {
      const authError = await requireSession();
      if (authError) return { data: null, error: authError };

      await this.syncLocalVisitFields(visitId, updates);

      return { data: {}, error: null };
    } catch (error) {
      console.error('❌ [visitService] updateVisit 오류:', error);
      return { data: null, error };
    }
  },

  async getVisit(visitId) {
    try {
      const sessionState = await ensureAuthenticatedSession();
      if (!sessionState.ok) return { data: null, error: sessionState.error };

      const { data, error } = await supabaseClient.getMyVisit({
        p_session_token: sessionState.session.token,
        p_visit_id: visitId,
      });

      if (error) return { data: null, error: withAuthErrorHandling(error, sessionState.error?.message) };

      const [card_image, card_review, title, ai_insight] = await Promise.all([
        storage.getCardImage(visitId),
        storage.getCardReview(visitId),
        storage.getCardTitle(visitId),
        storage.getCardAIInsight(visitId),
      ]);

      return {
        data: { ...data, is_manual: false, card_image, card_review, title, ai_insight },
        error: null,
      };
    } catch (error) {
      console.error('❌ [visitService] getVisit 오류:', error);
      return { data: null, error };
    }
  },

  async deleteVisit(visitId, customerId) {
    try {
      const sessionState = await ensureAuthenticatedSession();
      if (!sessionState.ok) return { error: sessionState.error };

      const { data, error } = await supabaseClient.hideMyVisit({
        p_session_token: sessionState.session.token,
        p_visit_id: visitId,
      });
      if (error) throw withAuthErrorHandling(error, sessionState.error?.message);
      if (data !== true) {
        throw new Error('Visit not found or already hidden.');
      }

      await Promise.all([
        storage.deleteCardImage(visitId),
        storage.deleteCardReview(visitId),
        storage.deleteCardTitle(visitId),
        storage.deleteCardAIInsight(visitId),
      ]);

      return { error: null };
    } catch (error) {
      console.error('❌ [visitService] deleteVisit 오류:', error);
      return { error };
    }
  },

  async getCustomerStats(customerId, signal = null) {
    if (customerId === 'guest') {
      return { data: { current_stamps: 0, visit_count: 0 }, error: null };
    }

    try {
      const sessionState = await ensureAuthenticatedSession();
      if (!sessionState.ok) return { data: null, error: sessionState.error };

      const { data, error } = await supabaseClient.getCustomerStats({
        p_session_token: sessionState.session.token,
      }, { abortSignal: signal });

      if (error) throw withAuthErrorHandling(error, sessionState.error?.message);
      if (!data?.success) {
        const statsError = {
          message: data?.message || 'Unable to load stamp information.',
          code: 'CUSTOMER_STATS_FAILED',
        };
        throw withAuthErrorHandling(statsError, statsError.message);
      }

      return {
        data: {
          current_stamps: data.current_stamps || 0,
          visit_count: data.visit_count || 0,
        },
        error: null,
      };
    } catch (error) {
      console.error('스탬프 정보 조회 실패:', error);
      return { data: null, error };
    }
  },
};
