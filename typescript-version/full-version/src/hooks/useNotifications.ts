import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthProvider'
import { useSocket } from './useSocket'
import { useUnreadMessages } from './useUnreadMessages'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from '@/redux-store'
import { addClearedNotifications } from '@/redux-store/slices/notifications'
import type { NotificationsType } from '@/components/layout/shared/NotificationsDropdown'
import { useTranslation } from '@/contexts/TranslationContext'

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<NotificationsType[]>([])
  const [loading, setLoading] = useState(true)
  const [previousUserId, setPreviousUserId] = useState<string | null>(null)
  const { user, session } = useAuth()
  const { socket, isConnected } = useSocket(user?.id || null)
  const { unreadCount: chatUnreadCount } = useUnreadMessages()
  const dictionary = useTranslation()

  // Helper functions for localStorage management
  const getClearedNotificationsKey = (userId: string) => `clearedNotifications_${userId}`

  const getClearedNotifications = (userId: string): Set<string> => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(getClearedNotificationsKey(userId))
      const parsed = stored ? JSON.parse(stored) : []
      return new Set(parsed)
    } catch (error) {
      console.error('Error parsing cleared notifications from localStorage:', error)
      return new Set()
    }
  }

  const setClearedNotifications = (userId: string, clearedIds: Set<string>) => {
    if (typeof window === 'undefined') return
    try {
      const arrayValue = Array.from(clearedIds)
      localStorage.setItem(getClearedNotificationsKey(userId), JSON.stringify(arrayValue))
    } catch (error) {
      console.error('Error saving cleared notifications to localStorage:', error)
    }
  }

  const clearUserClearedNotifications = (userId: string) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(getClearedNotificationsKey(userId))
    } catch (error) {
      console.error('Error clearing user notifications from localStorage:', error)
    }
  }

  // Load notifications from API
  const loadNotifications = async () => {
    if (!user?.id) return

    try {
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        const mappedNotifications = (data.notifications || []).map((notification: any) => ({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          status: notification.status,
          createdAt: notification.createdAt,
          updatedAt: notification.updatedAt,
          userId: notification.userId,
          // Keep backward compatibility fields
          subtitle: notification.subtitle || notification.message,
          time: notification.time || new Date(notification.createdAt).toLocaleString(),
          read: notification.read !== undefined ? notification.read : notification.status === 'read',
          avatarImage: notification.avatarImage,
          avatarIcon: notification.avatarIcon,
          avatarText: notification.avatarText,
          avatarColor: notification.avatarColor,
          avatarSkin: notification.avatarSkin,
        }))
        // Filter out notifications that were cleared for this user
        const userId = user?.id
        const clearedNotifications = userId ? getClearedNotifications(userId) : new Set<string>()
        const filteredNotifications = mappedNotifications.filter(notification =>
          !clearedNotifications.has((notification as any).id)
        )
        setNotifications(filteredNotifications)
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // Mark notification as read/unread
  const markAsRead = async (notificationId: string, read: boolean) => {
    try {
      const status = read ? 'read' : 'unread'
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notification =>
            (notification as any).id === notificationId
              ? { ...notification, read, status, updatedAt: new Date().toISOString() }
              : notification
          )
        )
      }
    } catch (error) {
      console.error('Error updating notification:', error)
    }
  }

  // Remove notification
  const removeNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setNotifications(prev =>
          prev.filter(notification => (notification as any).id !== notificationId)
        )
      }
    } catch (error) {
      console.error('Error removing notification:', error)
    }
  }

  // Clear all notifications (hide from dropdown for current session only)
  const clearAllNotifications = async () => {
    try {
      const response = await fetch('/api/notifications/clear-all', {
        method: 'DELETE',
      })

      if (response.ok) {
        // Mark all current notifications as cleared for this session
        // They will remain hidden until next login
        const currentNotificationIds = notifications
          .filter(notification => !(notification as any).id?.startsWith('virtual-'))
          .map(notification => (notification as any).id)

        if (user?.id) {
          const currentCleared = getClearedNotifications(user?.id)
          const newCleared = new Set([...currentCleared, ...currentNotificationIds])
          setClearedNotifications(user?.id, newCleared)
        }

        // Remove cleared notifications from current state (keep virtual chat notification)
        setNotifications(prev =>
          prev.filter(notification => (notification as any).id?.startsWith('virtual-'))
        )
      }
    } catch (error) {
      console.error('Error clearing all notifications:', error)
    }
  }

  // Listen for real-time notifications
  useEffect(() => {
    if (socket && isConnected) {
      const handleNewNotification = (notification: NotificationsType & { id: string }) => {
        setNotifications(prev => [notification, ...prev])
      }

      const handleNotificationUpdate = (data: { id: string; read: boolean }) => {
        setNotifications(prev =>
          prev.map(notification =>
            (notification as any).id === data.id
              ? { ...notification, read: data.read, status: data.read ? 'read' : 'unread', updatedAt: new Date().toISOString() }
              : notification
          )
        )
      }

      socket.on('new-notification', handleNewNotification)
      socket.on('notification-update', handleNotificationUpdate)

      return () => {
        socket.off('new-notification', handleNewNotification)
        socket.off('notification-update', handleNotificationUpdate)
      }
    }
  }, [socket, isConnected])

  // Load notifications on mount and when user changes
  useEffect(() => {
    loadNotifications()
  }, [user?.id])

  // Clear localStorage when user logs out (not on page reload)
  useEffect(() => {
    const currentUserId = user?.id

    // If we had a user before and now don't have one, user logged out
    if (previousUserId && !currentUserId) {
      clearUserClearedNotifications(previousUserId)
    }

    // Update previous user ID
    setPreviousUserId(currentUserId || null)
  }, [user?.id, previousUserId])

  // Create virtual chat notification - only show if there are unread messages
  const chatNotification: NotificationsType & { id: string; message?: string; type?: string; status?: string; createdAt?: string; updatedAt?: string; userId?: string } | null = chatUnreadCount > 0 ? {
    id: 'virtual-chat-unread',
    title: dictionary?.navigation?.unreadChatTitle || 'Unread Chat Messages',
    message: dictionary?.navigation?.unreadChatMessages ? dictionary.navigation.unreadChatMessages.replace('${count}', chatUnreadCount.toString()) : `You have ${chatUnreadCount} unread chat messages`,
    type: 'chat',
    status: 'unread',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: user?.id,
    subtitle: dictionary?.navigation?.unreadChatMessages ? dictionary.navigation.unreadChatMessages.replace('${count}', chatUnreadCount.toString()) : `You have ${chatUnreadCount} unread chat messages`,
    time: 'только что',
    read: false,
    avatarIcon: 'ri-wechat-line',
    avatarColor: 'success', // Changed to success color to match chat theme
  } : null

  // Combine real notifications with virtual chat notification
  const allNotifications = chatNotification ? [chatNotification, ...notifications] : notifications

  const unreadCount = allNotifications.filter(notification => !notification.read && (notification as any).status !== 'trash').length

  return {
    notifications: allNotifications,
    loading,
    unreadCount,
    markAsRead,
    removeNotification,
    clearAllNotifications,
    refresh: loadNotifications,
    setNotifications,
  }
}