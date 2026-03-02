import { supabaseClient } from './supabaseClient';
import { storage } from '../utils/storage';

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

  /**
   * 고객의 방문 기록 목록 조회
   */
  async getVisits(customerId) {
    // 게스트 모드: 빈 데이터 반환
    if (customerId === 'guest') {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await supabaseClient.getVisits(customerId);

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('❌ [visitService] getVisits 오류:', error.message);
      return { data: [], error };
    }
  },

  /**
   * 방문 기록 수정
   */
  async updateVisit(visitId, updates) {
    try {
      await this.syncLocalVisitFields(visitId, updates);

      const serverPayload = {};
      if (updates.visit_date) serverPayload.visit_date = updates.visit_date;
      if (updates.customer_id) serverPayload.customer_id = updates.customer_id;

      let updatedServerData = {};
      if (Object.keys(serverPayload).length > 0) {
        const { data, error } = await supabaseClient.updateVisit(visitId, serverPayload);

        if (error) throw error;
        updatedServerData = data;
      }

      return { data: updatedServerData, error: null };
    } catch (error) {
      console.error('❌ [visitService] updateVisit 오류:', error);
      return { data: null, error };
    }
  },

  /**
   * 새 방문 기록 생성
   */
  async createVisit(visitData) {
    try {
      const serverPayload = {
        customer_id: visitData.customer_id,
        visit_date: visitData.visit_date
      };

      // 게스트 모드: 서버 저장 차단
      if (visitData.customer_id === 'guest') {
        return { data: null, error: 'Guest cannot save to server' };
      }

      const { data, error } = await supabaseClient.createVisit(serverPayload);

      if (error) throw error;

      if (visitData.card_image) await storage.saveCardImage(data.id, visitData.card_image);
      if (visitData.card_review) await storage.saveCardReview(data.id, visitData.card_review);
      if (visitData.title) await storage.saveCardTitle(data.id, visitData.title);
      if (visitData.ai_insight) await storage.saveCardAIInsight(data.id, visitData.ai_insight);

      return {
        data: { ...data, is_manual: false },
        error: null
      };
    } catch (error) {
      console.error('❌ [visitService] createVisit 오류:', error);
      return { data: null, error };
    }
  },

  async getVisit(visitId) {
    const { data, error } = await supabaseClient.getVisit(visitId);

    if (error) return { data: null, error };

    return {
      data: {
        ...data,
        is_manual: false,
        card_image: await storage.getCardImage(visitId),
        card_review: await storage.getCardReview(visitId),
        title: await storage.getCardTitle(visitId),
        ai_insight: await storage.getCardAIInsight(visitId)
      },
      error: null
    };
  },

  /**
   * 방문 기록 삭제
   */
  async deleteVisit(visitId) {
    try {
      const { error } = await supabaseClient.softDeleteVisit(visitId);

      if (error) throw error;

      // 로컬 스토리지 정리
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
    // 게스트 모드: 기본 스탯 반환
    if (customerId === 'guest') {
      return { data: { current_stamps: 0, visit_count: 0 }, error: null };
    }

    try {
      const { data, error } = await supabaseClient.getCustomerStats(customerId);

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('스탬프 정보 조회 실패:', error);
      return { data: null, error };
    }
  }
};