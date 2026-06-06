import { supabaseClient } from './supabaseClient';
import { ensureAuthenticatedSession, withAuthErrorHandling } from './supabase';
import { storage } from '../utils/storage';

const requireSession = async () => {
  const session = await ensureAuthenticatedSession();
  return session.ok ? null : session.error;
};

const getSessionState = async () => ensureAuthenticatedSession();

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
      const sessionState = await getSessionState();
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

  async updateVisit(visitId, updates) {
    try {
      const authError = await requireSession();
      if (authError) return { data: null, error: authError };

      await this.syncLocalVisitFields(visitId, updates);

      const serverPayload = {};
      if (updates.visit_date) serverPayload.visit_date = updates.visit_date;
      if (updates.customer_id) serverPayload.customer_id = updates.customer_id;

      let updatedServerData = {};
      if (Object.keys(serverPayload).length > 0) {
        const { data, error } = await supabaseClient.updateVisit(visitId, serverPayload);

        if (error) throw withAuthErrorHandling(error, authError.message);
        updatedServerData = data;
      }

      return { data: updatedServerData, error: null };
    } catch (error) {
      console.error('❌ [visitService] updateVisit 오류:', error);
      return { data: null, error };
    }
  },

  async createVisit(visitData) {
    try {
      if (visitData.customer_id === 'guest') {
        return { data: null, error: 'Guest cannot save to server' };
      }

      const authError = await requireSession();
      if (authError) return { data: null, error: authError };

      const serverPayload = {
        customer_id: visitData.customer_id,
        visit_date: visitData.visit_date,
      };

      const { data, error } = await supabaseClient.createVisit(serverPayload);

      if (error) throw withAuthErrorHandling(error, authError?.message);

      if (visitData.card_image) await storage.saveCardImage(data.id, visitData.card_image);
      if (visitData.card_review) await storage.saveCardReview(data.id, visitData.card_review);
      if (visitData.title) await storage.saveCardTitle(data.id, visitData.title);
      if (visitData.ai_insight) await storage.saveCardAIInsight(data.id, visitData.ai_insight);

      return { data: { ...data, is_manual: false }, error: null };
    } catch (error) {
      console.error('❌ [visitService] createVisit 오류:', error);
      return { data: null, error };
    }
  },

  async getVisit(visitId) {
    try {
      const sessionState = await getSessionState();
      if (!sessionState.ok) return { data: null, error: sessionState.error };

      const { data, error } = await supabaseClient.getMyVisit({
        p_session_token: sessionState.session.token,
        p_visit_id: visitId,
      });

      if (error) return { data: null, error: withAuthErrorHandling(error, sessionState.error?.message) };

      return {
        data: {
          ...data,
          is_manual: false,
          card_image: await storage.getCardImage(visitId),
          card_review: await storage.getCardReview(visitId),
          title: await storage.getCardTitle(visitId),
          ai_insight: await storage.getCardAIInsight(visitId),
        },
        error: null,
      };
    } catch (error) {
      console.error('❌ [visitService] getVisit 오류:', error);
      return { data: null, error };
    }
  },

  async deleteVisit(visitId, customerId) {
    try {
      const sessionState = await getSessionState();
      if (!sessionState.ok) return { error: sessionState.error };

      const { data, error } = await supabaseClient.hideMyVisit({
        p_session_token: sessionState.session.token,
        p_visit_id: visitId,
      });
      if (error) throw withAuthErrorHandling(error, sessionState.error?.message);
      if (data !== true) {
        throw new Error('Visit not found or already hidden.');
      }

      await storage.deleteCardImage(visitId);
      await storage.deleteCardReview(visitId);
      await storage.deleteCardTitle(visitId);
      await storage.deleteCardAIInsight(visitId);

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
      const sessionState = await getSessionState();
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
