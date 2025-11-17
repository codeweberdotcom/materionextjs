import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { Notification as DbNotification } from '@prisma/client'
import { prisma } from '@/libs/prisma'
import { getSocketServer } from '@/lib/sockets'
import { parseNotificationMetadata, serializeNotificationMetadata } from '@/utils/notifications/metadata'
import type { NotificationMetadata } from '@/lib/sockets/types/notifications'

type ApiNotification = {
  id: string
  title: string
  message: string
  type: DbNotification['type']
  status: DbNotification['status']
  createdAt: string
  updatedAt: string
  userId: string
  readAt: string | null
  metadata: NotificationMetadata
  subtitle: string
  time: string
  read: boolean
  avatarImage?: string
  avatarIcon?: string
  avatarText?: string
  avatarColor?: string
  avatarSkin?: string
}

type NotificationEvent = 'newNotification' | 'notificationUpdate' | 'notificationDeleted' | 'notificationsRead'

const toApiNotification = (notification: DbNotification): ApiNotification => ({
  id: notification.id,
  title: notification.title,
  message: notification.message,
  type: notification.type,
  status: notification.status,
  createdAt: notification.createdAt.toISOString(),
  updatedAt: notification.updatedAt.toISOString(),
  userId: notification.userId,
  readAt: notification.readAt ? notification.readAt.toISOString() : null,
  metadata: parseNotificationMetadata(notification.metadata),
  subtitle: notification.message,
  time: new Date(notification.createdAt).toLocaleString(),
  read: notification.status === 'read',
  avatarImage: notification.avatarImage || undefined,
  avatarIcon: notification.avatarIcon || undefined,
  avatarText: notification.avatarText || undefined,
  avatarColor: notification.avatarColor || undefined,
  avatarSkin: notification.avatarSkin || undefined
})

const emitNotificationEvent = (userId: string, event: NotificationEvent, payload: ApiNotification) => {
  const io = getSocketServer()
  if (!io) return

  const namespace = io.of('/notifications')
  namespace.to(`user_${userId}`).emit(event, payload)

  const legacyMap: Record<NotificationEvent, string> = {
    newNotification: 'new-notification',
    notificationUpdate: 'notification-update',
    notificationDeleted: 'notification-deleted',
    notificationsRead: 'notifications-read'
  }

  if (legacyMap[event]) {
    namespace.to(`user_${userId}`).emit(legacyMap[event], payload)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = Number(searchParams.get('limit')) || 100

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    const transformedNotifications = notifications.map(toApiNotification)

    return NextResponse.json({
      notifications: transformedNotifications,
      total: notifications.length,
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, message, type, avatarImage, avatarIcon, avatarText, avatarColor, avatarSkin, metadata } = body

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })
    }

    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        title,
        message,
        type: type || 'system',
        status: 'unread',
        avatarImage,
        avatarIcon,
        avatarText,
        avatarColor,
        avatarSkin,
        metadata: serializeNotificationMetadata(metadata)
      }
    })

    const payload = toApiNotification(notification)
    emitNotificationEvent(user.id, 'newNotification', payload)

    return NextResponse.json({
      notification: payload
    })
  } catch (error) {
    console.error('Error creating notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


