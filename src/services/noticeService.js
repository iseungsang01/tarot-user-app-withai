import { supabase } from './supabase';
import { supabaseClient } from './supabaseClient';
import { storage } from '../utils/storage';
import { requireCustomerSessionToken } from './customerSession';

/**
 * 공지사항 및 버그 리포트 서비스
 * 공지사항 읽음 처리는 로컬 스토리지에서만 관리
 */
export const noticeService = {
  async getPublishedNoticeIds() {
    const { data, error } = await supabase.from('notices').select('id').eq('is_published', true);
    if (error) throw error;
    return (data || []).map((notice) => notice.id);
  },

  /**
   * 공지사항 목록 조회
   * @returns {object} { data, error }
   */
  async getNotices() {
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('is_published', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Get notices error:', error);
      return { data: [], error };
    }
  },

  /**
   * 공지사항 읽음 처리 (로컬 스토리지만 사용)
   * 모든 공지사항을 읽음으로 표시
   *
   * @returns {object} { error }
   */
  async markAllNoticesAsRead() {
    try {
      const noticeIds = await this.getPublishedNoticeIds();
      await storage.markNoticesAsRead(noticeIds);
      return { error: null };
    } catch (error) {
      console.error('Mark notices as read error:', error);
      return { error };
    }
  },

  /**
   * 특정 공지사항 읽음 처리
   * @param {number} noticeId - 공지사항 ID
   * @returns {object} { error }
   */
  async markNoticeAsRead(noticeId) {
    try {
      await storage.markNoticeAsRead(noticeId);
      return { error: null };
    } catch (error) {
      console.error('Mark notice as read error:', error);
      return { error };
    }
  },

  /**
   * 안 읽은 공지사항 개수 조회 (로컬 스토리지 사용)
   * @returns {object} { count, error }
   */
  async getUnreadNoticeCount() {
    try {
      const noticeIds = await this.getPublishedNoticeIds();
      const unreadCount = await storage.getUnreadNoticeCount(noticeIds);
      return { count: unreadCount, error: null };
    } catch (error) {
      console.error('Get unread notice count error:', error);
      return { count: 0, error };
    }
  },

  /**
   * 안 읽은 공지사항이 있는지 확인 (최적화)
   * @returns {object} { hasUnread, error }
   */
  async hasUnreadNotices() {
    try {
      const noticeIds = await this.getPublishedNoticeIds();
      const readNotices = await storage.syncReadNotices(noticeIds);
      return { hasUnread: noticeIds.some((id) => !readNotices.includes(id)), error: null };
    } catch (error) {
      console.error('Check unread notices error:', error);
      return { hasUnread: false, error };
    }
  },

  /**
   * 버그 리포트 제출
   * @param {object} reportData - 리포트 데이터
   * @returns {object} { data, error }
   */
  async submitReport(reportData) {
    if (reportData.customer_id === 'guest') return { data: null, error: 'Guest cannot submit reports' };
    try {
      const token = await requireCustomerSessionToken();
      const { data, error } = await supabaseClient.submitBugReport({
        p_session_token: token,
        p_title: reportData.title,
        p_description: reportData.description,
        p_report_type: reportData.report_type || '어플 버그',
        p_screenshot: reportData.screenshot || null,
        p_device_info: reportData.device_info || null,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Submit report error:', error);
      return { data: null, error };
    }
  },

  /**
   * 내 버그 리포트 목록 조회
   * @param {string} customerId - 고객 ID (UUID)
   * @returns {object} { data, error }
   */
  async getMyReports(customerId) {
    if (customerId === 'guest') return { data: [], error: null };
    try {
      const token = await requireCustomerSessionToken();
      const { data, error } = await supabaseClient.getMyBugReports({
        p_session_token: token,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Get my reports error:', error);
      return { data: [], error };
    }
  },
};
