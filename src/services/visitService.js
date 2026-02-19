import { supabase } from './supabase';
import { storage } from '../utils/storage';

export const visitService = {
  /**
   * 고객의 방문 기록 목록 조회
   */
  async getVisits(customerId) {
    // ✅ 게스트 모드: 빈 데이터 반환
    if (customerId === 'guest') {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await supabase
        .from('visit_history')
        .select('id, customer_id, visit_date')
        .eq('customer_id', customerId)
        .eq('is_deleted', false)
        .order('visit_date', { ascending: false });

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
      // 1. 로컬 데이터 처리 (이미지/리뷰) - *여전히 UI에서 개별 호출하거나 훅에서 처리 가능하지만, 호환성을 위해 유지하되 단순화*
      if (updates.card_image !== undefined) {
        updates.card_image ? await storage.saveCardImage(visitId, updates.card_image) : await storage.deleteCardImage(visitId);
      }
      if (updates.card_review !== undefined) {
        updates.card_review ? await storage.saveCardReview(visitId, updates.card_review) : await storage.deleteCardReview(visitId);
      }

      // 2. 서버 업데이트
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

      // ✅ 게스트 모드: 서버 저장 차단 (혹은 에러 반환)
      if (visitData.customer_id === 'guest') {
        return { data: null, error: 'Guest cannot save to server' };
      }

      const { data, error } = await supabase
        .from('visit_history')
        .insert(serverPayload)
        .select()
        .single();

      if (error) throw error;

      if (visitData.card_image) await storage.saveCardImage(data.id, visitData.card_image);
      if (visitData.card_review) await storage.saveCardReview(data.id, visitData.card_review);

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
    const { data, error } = await supabase
      .from('visit_history')
      .select('id, customer_id, visit_date')
      .eq('id', visitId)
      .eq('is_deleted', false)
      .single();

    if (error) return { data: null, error };

    return {
      data: {
        ...data,
        is_manual: false,
        card_image: await storage.getCardImage(visitId),
        card_review: await storage.getCardReview(visitId)
      },
      error: null
    };
  },

  /**
   * ✅ 방문 기록 삭제 (Soft Delete + 로컬 스토리지 완전 정리)
   */
  async deleteVisit(visitId) {
    try {
      const { error } = await supabase
        .from('visit_history')
        .update({ is_deleted: true })
        .eq('id', visitId);

      if (error) throw error;

      // 로컬 스토리지 정리
      await storage.deleteCardImage(visitId);
      await storage.deleteCardReview(visitId);

      return { error: null };
    } catch (error) {
      console.error('❌ [visitService] deleteVisit 오류:', error);
      return { error };
    }
  },

  async getCustomerStats(customerId) {
    // ✅ 게스트 모드: 기본 스탯 반환
    if (customerId === 'guest') {
      return { data: { current_stamps: 0, visit_count: 0 }, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('current_stamps, visit_count')
        .eq('id', customerId)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('스탬프 정보 조회 실패:', error);
      return { data: null, error };
    }
  }
};