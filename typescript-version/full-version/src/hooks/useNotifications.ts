import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAuth } from '@/contexts/AuthProvider'
import { useSockets } from '@/contexts/SocketProvider'
import type { RootState, AppDispatch } from '@/redux-store'
import type { Notification, NotificationStatus, NotificationType } from '@/types/apps/notificationTypes'
import { parseNotificationMetadata } from '@/utils/notifications/metadata'
import {
  deleteNotification as deleteNotificationAction,
  filterNotifications,
  markAllAsRead as markAllAsReadAction,
  setLoading,
  setNotifications as setNotificationsAction,
  upsertNotification,
  updateNotification
} from '@/redux-store/slices/notifications'
import logger from '@/lib/logger'

type FilterPayload = {
  status?: NotificationStatus | 'all'
  type?: NotificationType | 'all'
}

const normalizeNotification = (notification: any): Notification => ({
  id: notification.id,
  title: notification.title,
  message: notification.message,
  subtitle: notification.subtitle ?? notification.message,
  type: notification.type,
  status: notification.status === 'trash' ? 'archived' : notification.status,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
  userId: notification.userId,
  readAt: notification.readAt ?? (notification.status === 'read' ? notification.updatedAt : null),
  avatarImage: notification.avatarImage,
  avatarIcon: notification.avatarIcon,
  avatarText: notification.avatarText,
  avatarColor: notification.avatarColor,
  avatarSkin: notification.avatarSkin,
  metadata: parseNotificationMetadata(notification.metadata)
})

export const useNotifications = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { user } = useAuth()
  const { notificationSocket } = useSockets()
  const { notifications, filteredNotifications, loading, filters } = useSelector(
    (state: RootState) => state.notificationsReducer
  )
  const filtersRef = useRef(filters)

  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  const unreadCount = useMemo(
    () => notifications.filter(notification => notification.status === 'unread').length,
    [notifications]
  )

  const refresh = useCallback(async (source = 'manual') => {
    if (!user?.id) return

    logger.info('Refreshing notifications', { source, userId: user.id })
    dispatch(setLoading(true))
    try {
      const response = await fetch('/api/notifications', {
        method: 'GET'
      })

      if (response.ok) {
        const data = await response.json()
        const mapped = (data.notifications || []).map(normalizeNotification)
        dispatch(setNotificationsAction(mapped))
        dispatch(filterNotifications(filtersRef.current))
        logger.info('Notifications refreshed', {
          source,
          userId: user.id,
          total: mapped.length
        })
      }
    } catch (error) {
      logger.error('Error refreshing notifications', {
        source,
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch, user?.id])

  const markAsRead = useCallback(
    async (notificationId: string, read = true) => {
      if (!user?.id) return

      const status: NotificationStatus = read ? 'read' : 'unread'
      const payload = { notificationId, updates: { status, readAt: read ? new Date().toISOString() : null } }

      try {
        if (notificationSocket?.connected) {
          notificationSocket.emit('markAsRead', {
            notificationId,
            userId: user.id,
            read
          })
        } else {
          await fetch(`/api/notifications/${notificationId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
          })
        }

        dispatch(updateNotification(payload))
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    },
    [dispatch, notificationSocket, user?.id]
  )

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return

    try {
      if (notificationSocket?.connected) {
        notificationSocket.emit('markAllAsRead', user.id)
      } else {
        await fetch('/api/notifications/mark-all', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ read: true })
        })
      }

      dispatch(markAllAsReadAction())
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }, [dispatch, notificationSocket, user?.id])

  const updateStatus = useCallback(
    async (notificationId: string, status: NotificationStatus) => {
      if (!user?.id) return

      try {
        await fetch(`/api/notifications/${notificationId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status })
        })

        dispatch(updateNotification({ notificationId, updates: { status } }))
      } catch (error) {
        console.error('Error updating notification status:', error)
      }
    },
    [dispatch, user?.id]
  )

  const removeNotification = useCallback(
    async (notificationId: string) => {
      if (!user?.id) return

      try {
        if (notificationSocket?.connected) {
          notificationSocket.emit('deleteNotification', {
            notificationId,
            userId: user.id
          })
        } else {
          await fetch(`/api/notifications/${notificationId}`, {
            method: 'DELETE'
          })
        }

        dispatch(deleteNotificationAction({ notificationId }))
      } catch (error) {
        console.error('Error deleting notification:', error)
      }
    },
    [dispatch, notificationSocket, user?.id]
  )

  const clearAllNotifications = useCallback(async () => {
    if (!user?.id) return

    try {
      await fetch('/api/notifications/clear-all', {
        method: 'DELETE'
      })
      await refresh('clear-all')
    } catch (error) {
      console.error('Error clearing notifications:', error)
    }
  }, [refresh, user?.id])

  const setFilters = useCallback(
    (nextFilters: FilterPayload) => {
      logger.info('Applying notification filters', nextFilters)
      dispatch(filterNotifications(nextFilters))
    },
    [dispatch]
  )

  useEffect(() => {
    if (!user?.id) {
      dispatch(setNotificationsAction([]))
    }
  }, [dispatch, user?.id])

  useEffect(() => {
    if (!notificationSocket) return

    const handleNewNotification = (notification: any) => {
      dispatch(upsertNotification(normalizeNotification(notification)))
    }

    const handleNotificationUpdate = (payload: any) => {
      const notificationId = payload.notificationId ?? payload.id
      if (!notificationId) return

      const updates = payload.updates ?? {
        status: payload.read ? 'read' : 'unread',
        readAt: payload.read ? new Date().toISOString() : null
      }

      dispatch(updateNotification({ notificationId, updates }))
    }

    const handleNotificationDeleted = (payload: any) => {
      const notificationId = payload.notificationId ?? payload.id
      if (!notificationId) return
      dispatch(deleteNotificationAction({ notificationId }))
    }

    const handleNotificationsRead = (payload: { userId: string }) => {
      if (payload.userId !== user?.id) return
      dispatch(markAllAsReadAction())
    }

    notificationSocket.on('newNotification', handleNewNotification)
    notificationSocket.on('new-notification', handleNewNotification)
    notificationSocket.on('notificationUpdate', handleNotificationUpdate)
    notificationSocket.on('notification-update', handleNotificationUpdate)
    notificationSocket.on('notificationDeleted', handleNotificationDeleted)
    notificationSocket.on('notificationsRead', handleNotificationsRead)

    return () => {
      notificationSocket.off('newNotification', handleNewNotification)
      notificationSocket.off('new-notification', handleNewNotification)
      notificationSocket.off('notificationUpdate', handleNotificationUpdate)
      notificationSocket.off('notification-update', handleNotificationUpdate)
      notificationSocket.off('notificationDeleted', handleNotificationDeleted)
      notificationSocket.off('notificationsRead', handleNotificationsRead)
    }
  }, [dispatch, notificationSocket, user?.id])

  return {
    notifications,
    filteredNotifications,
    loading,
    unreadCount,
    filters,
    markAsRead,
    markAllAsRead,
    updateStatus,
    removeNotification,
    clearAllNotifications,
    refresh,
    setFilters
  }
}
