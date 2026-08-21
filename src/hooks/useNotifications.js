import { useState, useEffect, useCallback } from 'react';
import { noticeService } from '../services/noticeService';
import { useAuth } from './useAuth';

/**
 * 읽음 처리를 한 쪽(소식 화면)과 빨간 점을 그리는 쪽(탭바)이 서로 다른
 * 트리에 있어서, 알려주지 않으면 공지를 다 읽어도 점이 그대로 남는다.
 */
const readListeners = new Set();

/** 공지를 읽음 처리한 뒤 호출한다. 마운트된 모든 훅이 상태를 다시 읽는다. */
export const notifyNoticesRead = () => {
  readListeners.forEach((fn) => fn());
};

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

  useEffect(() => {
    readListeners.add(loadNotifications);
    return () => readListeners.delete(loadNotifications);
  }, [loadNotifications]);

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
