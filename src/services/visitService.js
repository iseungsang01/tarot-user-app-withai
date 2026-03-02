import { ensureAuthenticatedSession, supabase, withAuthErrorHandling } from './supabase';
import { storage } from '../utils/storage';

const authFailure = (message = '인증이 만료되었습니다. 다시 로그인해주세요.') => ({
  message,
  requiresReLogin: true,
  isAuthError: true,
});

const requireSession = async () => {
  const session = await ensureAuthenticatedSession();
  return session.ok ? null : authFailure(session.error?.message);
};

export const visitService = {
  syncLocalVisitFields: async (visitId, updates) => {
    const localFieldHandlers = {
      card_image: [storage.saveCardImage, storage.deleteCardImage],
      card_review: [storage.saveCardReview, storage.deleteCardReview],
      title: [storage.saveCardTitle, storage.deleteCardTitle],
      ai_insight: [storage.saveCardAIInsight, storage.deleteCardAIInsight],
    };

    await Promise.all(
      Object.entries(localFieldHandlers).map(async ([field, [saveFn, deleteFn]]) => {
        if (updates[field] === undefined) return;
        return updates[field] ? saveFn(visitId, updates[field]) : deleteFn(visitId);
      }),
    );
  },

  async getVisits(customerId) {
    if (customerId === 'guest') return { data: [], error: null };

    try {
      const authError = await requireSession();
      if (authError) return { data: [], error: authError };

      const { data, error } = await supabase
        .from('visit_history')
        .select('id, customer_id, visit_date')
        .eq('customer_id', customerId)
        .eq('is_deleted', false)
        .order('visit_date', { ascending: false });

      if (error) throw withAuthErrorHandling(error, authError.message);
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
        const { data, error } = await supabase
          .from('visit_history')
          .update(serverPayload)
          .eq('id', visitId)
          .select()
          .single();

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
      const serverPayload = {
        customer_id: visitData.customer_id,
        visit_date: visitData.visit_date,
      };

      if (visitData.customer_id === 'guest') {
        return { data: null, error: 'Guest cannot save to server' };
      }

      const authError = await requireSession();
      if (authError) return { data: null, error: authError };

      const { data, error } = await supabase
        .from('visit_history')
        .insert(serverPayload)
        .select()
        .single();

      if (error) throw withAuthErrorHandling(error, authError.message);

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
    const authError = await requireSession();
    if (authError) return { data: null, error: authError };

    const { data, error } = await supabase
      .from('visit_history')
      .select('id, customer_id, visit_date')
      .eq('id', visitId)
      .eq('is_deleted', false)
      .single();

    if (error) return { data: null, error: withAuthErrorHandling(error, authError.message) };

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
  },

  async deleteVisit(visitId) {
    try {
      const authError = await requireSession();
      if (authError) return { error: authError };

      const { error } = await supabase
        .from('visit_history')
        .update({ is_deleted: true })
        .eq('id', visitId);

      if (error) throw withAuthErrorHandling(error, authError.message);

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

  async getCustomerStats(customerId) {
    if (customerId === 'guest') {
      return { data: { current_stamps: 0, visit_count: 0 }, error: null };
    }

    try {
      const authError = await requireSession();
      if (authError) return { data: null, error: authError };

      const { data, error } = await supabase
        .from('customers')
        .select('current_stamps, visit_count')
        .eq('id', customerId)
        .single();

      if (error) throw withAuthErrorHandling(error, authError.message);

      return { data, error: null };
    } catch (error) {
      console.error('스탬프 정보 조회 실패:', error);
      return { data: null, error };
    }
  },
};
