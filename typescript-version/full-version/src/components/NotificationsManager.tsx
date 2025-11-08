'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthProvider'
import type { Notification } from '../lib/sockets/types/notifications'

export function NotificationsManager() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const { user, session } = useAuth()

  // Загрузка уведомлений из API
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
          readAt: notification.readAt,
          metadata: notification.metadata
        }))
        setNotifications(mappedNotifications)
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // Загрузка уведомлений при монтировании
  useEffect(() => {
    loadNotifications()
  }, [user?.id])

  // Экспортируем данные для использования в других компонентах
  const unreadCount = notifications.filter(notification => notification.status === 'unread').length

  // Сохраняем в window для доступа из других компонентов
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).notificationsManager = {
        notifications,
        loading,
        unreadCount,
        setNotifications
      }
    }
  }, [notifications, loading, unreadCount])

  return null // Этот компонент ничего не рендерит
}