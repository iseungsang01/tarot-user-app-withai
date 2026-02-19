import { useState, useEffect, useCallback } from 'react';
import { noticeService } from '../services/noticeService';
import { useAuth } from './useAuth';

/**
 * 알림 관리 Hook (최적화)
 * 빨간 점 표시를 위한 boolean 값만 반환
 * bug_reports의 admin_response 기능 제거로 인해 hasUnreadResponses는 항상 false
 * 
 * @returns {object} { 
 *   hasUnreadNotices,
 *   hasAnyUnread,
 *   loading,
 *   refresh 
 * }
 * 
 * @example
 * const { hasAnyUnread, refresh } = useNotifications();
 * 
 * // 탭 바에 빨간 점 표시
 * {hasAnyUnread && <View style={styles.redDot} />}
 */
export const useNotifications = () => {
  const { customer } = useAuth();
  const [hasUnreadNotices, setHasUnreadNotices] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, [customer]);

  /**
   * 알림 상태 로드 (최적화)
   * 개수 대신 boolean 값만 조회
   */
  const loadNotifications = async () => {
    // customer 정보가 로딩 중일 때는 건너뜀 (단, guest는 허용)
    // AuthContext의 loading 상태가 false일 때 실행하는 것이 안전
    setLoading(true);

    try {
      // 안 읽은 공지사항 있는지 확인
      const { hasUnread: hasNotices } = await noticeService.hasUnreadNotices();
      setHasUnreadNotices(hasNotices);
    } catch (error) {
      console.error('Load notifications error:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 알림 새로고침
   */
  const refresh = useCallback(() => {
    loadNotifications();
  }, []);

  /**
   * 하나라도 안 읽은 알림이 있는지
   * (현재는 공지사항만 확인)
   */
  const hasAnyUnread = hasUnreadNotices;

  return {
    hasUnreadNotices,      // 안 읽은 공지사항 있음
    hasAnyUnread,          // 안 읽은 알림 있음 (현재는 공지사항만)
    loading,
    refresh,
  };
};