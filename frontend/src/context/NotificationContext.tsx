import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Notification, NotificationListParams } from '../types';
import { api } from '../services/api';

interface NotificationContextType {
  unreadCount: number;
  recentNotifications: Notification[];
  loading: boolean;
  toasts: Notification[];
  dismissToast: (id: string) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archiveNotification: (id: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode; isAuthenticated: boolean }> = ({
  children,
  isAuthenticated,
}) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Notification[]>([]);
  
  const prevCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef<boolean>(true);

  // Fetch unread count
  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.getUnreadCount();
      const newCount = res.unread_count;

      // If new notifications arrived and it's not the initial load, trigger toast
      if (!isFirstLoadRef.current && newCount > prevCountRef.current) {
        // Fetch the newest unread notifications to show in toast
        try {
          const listRes = await api.getNotifications({ page: 1, page_size: 5, unread_only: true });
          const newItems = listRes.results.slice(0, newCount - prevCountRef.current);
          if (newItems.length > 0) {
            setToasts((prev) => {
              const existingIds = new Set(prev.map((t) => t.id));
              const additions = newItems.filter((item) => !existingIds.has(item.id));
              return [...additions, ...prev].slice(0, 4); // Max 4 toasts simultaneously
            });
          }
        } catch {
          // Toast fetch failure fallback
        }
      }

      setUnreadCount(newCount);
      prevCountRef.current = newCount;
      isFirstLoadRef.current = false;
    } catch {
      // Inactive or unauthenticated
    }
  }, [isAuthenticated]);

  // Fetch recent notifications for top navigation popover
  const refreshRecent = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await api.getNotifications({ page: 1, page_size: 10, archived: 'active' });
      setRecentNotifications(res.results);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const refreshNotifications = useCallback(async () => {
    await Promise.all([refreshUnreadCount(), refreshRecent()]);
  }, [refreshUnreadCount, refreshRecent]);

  // Initial load and periodic polling every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setRecentNotifications([]);
      setToasts([]);
      isFirstLoadRef.current = true;
      return;
    }

    refreshNotifications();

    const interval = setInterval(() => {
      refreshUnreadCount();
    }, 30000); // 30s background sync

    const handleFocus = () => {
      refreshUnreadCount();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, refreshNotifications, refreshUnreadCount]);

  // Dismiss toast
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setRecentNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      dismissToast(id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [dismissToast]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead();
      const now = new Date().toISOString();
      setRecentNotifications((prev) => prev.map((n) => ({ ...n, read_at: now })));
      setUnreadCount(0);
      setToasts([]);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, []);

  // Archive notification
  const archiveNotification = useCallback(async (id: string) => {
    try {
      await api.archiveNotification(id);
      setRecentNotifications((prev) => prev.filter((n) => n.id !== id));
      refreshUnreadCount();
      dismissToast(id);
    } catch (err) {
      console.error('Failed to archive notification:', err);
    }
  }, [dismissToast, refreshUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        recentNotifications,
        loading,
        toasts,
        dismissToast,
        markAsRead,
        markAllAsRead,
        archiveNotification,
        refreshNotifications,
        refreshUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
