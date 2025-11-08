import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthProvider';
import { useSocketNew } from './useSocketNew';
import type { Notification } from '../lib/sockets/types/notifications';

export const useNotificationsNew = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, session } = useAuth();
  const { notificationSocket } = useSocketNew();

  // Загрузка уведомлений из API
  const loadNotifications = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        const mappedNotifications = (data.notifications || []).map((notification: any) => ({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          status: notification.status,
          createdAt: notification.createdAt,
          updatedAt: notification.updatedAt,
          userId: notification.userId,
          readAt: notification.readAt,
          metadata: notification.metadata
        }));
        setNotifications(mappedNotifications);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Отметка уведомления как прочитанное
  const markAsRead = async (notificationId: string) => {
    if (!notificationSocket || !user?.id) return;

    try {
      notificationSocket.emit('markAsRead', {
        notificationId,
        userId: user?.id
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Отметка всех уведомлений как прочитанные
  const markAllAsRead = async () => {
    if (!notificationSocket || !user?.id) return;

    try {
      notificationSocket.emit('markAllAsRead', user?.id);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Удаление уведомления
  const removeNotification = async (notificationId: string) => {
    if (!notificationSocket || !user?.id) return;

    try {
      notificationSocket.emit('deleteNotification', {
        notificationId,
        userId: user?.id
      });
    } catch (error) {
      console.error('Error removing notification:', error);
    }
  };

  // Обработка событий уведомлений
  useEffect(() => {
    if (!notificationSocket) return;

    // Новое уведомление
    const handleNewNotification = (notification: Notification) => {
      setNotifications(prev => [notification, ...prev]);
    };

    // Уведомление обновлено
    const handleNotificationUpdate = (data: { notificationId: string; updates: any }) => {
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === data.notificationId
            ? { ...notification, ...data.updates }
            : notification
        )
      );
    };

    // Уведомление удалено
    const handleNotificationDeleted = (data: { notificationId: string }) => {
      setNotifications(prev =>
        prev.filter(notification => notification.id !== data.notificationId)
      );
    };

    // Все уведомления отмечены как прочитанные
    const handleNotificationsRead = (data: { userId: string; count: number }) => {
      if (data.userId === user?.id) {
        setNotifications(prev =>
          prev.map(notification => ({
            ...notification,
            status: 'read' as const
          }))
        );
      }
    };

    // Регистрируем обработчики
    notificationSocket.on('newNotification', handleNewNotification);
    notificationSocket.on('notificationUpdate', handleNotificationUpdate);
    notificationSocket.on('notificationDeleted', handleNotificationDeleted);
    notificationSocket.on('notificationsRead', handleNotificationsRead);

    // Cleanup
    return () => {
      notificationSocket.off('newNotification', handleNewNotification);
      notificationSocket.off('notificationUpdate', handleNotificationUpdate);
      notificationSocket.off('notificationDeleted', handleNotificationDeleted);
      notificationSocket.off('notificationsRead', handleNotificationsRead);
    };
  }, [notificationSocket, user?.id]);

  // Загрузка уведомлений при монтировании
  useEffect(() => {
    loadNotifications();
  }, [user?.id]);

  const unreadCount = notifications.filter(notification => notification.status === 'unread').length;

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    refresh: loadNotifications,
    setNotifications,
  };
};
