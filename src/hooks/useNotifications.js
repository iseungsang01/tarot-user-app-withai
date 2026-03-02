import { useState, useEffect, useCallback } from 'react';
import { noticeService } from '../services/noticeService';
import { useAuth } from './useAuth';

/** 알림 상태(Boolean)만 관리하는 훅 */
export const useNotifications = () => {
  const { customer } = useAuth();
  const [hasUnreadNotices, setHasUnreadNotices] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);

    try {
      const { hasUnread: hasNotices } = await noticeService.hasUnreadNotices();
      setHasUnreadNotices(hasNotices);
    } catch (error) {
      console.error('Load notifications error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [customer, loadNotifications]);

  /**
   * 알림 새로고침
   */
  const refresh = useCallback(() => loadNotifications(), [loadNotifications]);

  const hasAnyUnread = hasUnreadNotices;

  return {
    hasUnreadNotices,      // 안 읽은 공지사항 있음
    hasAnyUnread,          // 안 읽은 알림 있음 (현재는 공지사항만)
    loading,
    refresh,
  };
};
