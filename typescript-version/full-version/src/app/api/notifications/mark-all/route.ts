import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { getSocketServer } from '@/lib/sockets'

const emitNotificationsRead = (userId: string, notificationIds: string[]) => {
  const io = getSocketServer()
  if (!io) return

  const namespace = io.of('/notifications')
  const payload = {
    userId,
    count: notificationIds.length,
    notificationIds
  }

  namespace.to(`user_${userId}`).emit('notificationsRead', payload)
  namespace.to(`user_${userId}`).emit('notifications-read', payload)
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const unreadNotifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        status: 'unread'
      },
      select: { id: true }
    })

    if (unreadNotifications.length === 0) {
      emitNotificationsRead(user.id, [])
      return NextResponse.json({ success: true })
    }

    await prisma.notification.updateMany({
      where: {
        id: {
          in: unreadNotifications.map(notification => notification.id)
        }
      },
      data: {
        status: 'read',
        readAt: new Date()
      }
    })

    emitNotificationsRead(
      user.id,
      unreadNotifications.map(notification => notification.id)
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating all notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


