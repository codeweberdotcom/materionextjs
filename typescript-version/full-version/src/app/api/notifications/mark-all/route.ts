import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
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

export const PATCH = withApiHandler({
  handler: async ({ user }) => {
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
  }
})
