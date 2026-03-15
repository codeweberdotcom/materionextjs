import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { prisma } from '@/libs/prisma'
import { getSocketServer } from '@/lib/sockets'

const emitNotificationUpdate = (userId: string, notificationId: string, status: string) => {
  const io = getSocketServer()

  if (!io) return

  const namespace = io.of('/notifications')

  const payload = {
    notificationId,
    updates: {
      status
    },
    userId
  }

  namespace.to(`user_${userId}`).emit('notificationUpdate', payload)
  namespace.to(`user_${userId}`).emit('notification-update', payload)
}

export const DELETE = withApiHandler({
  handler: async ({ user }) => {
    const notificationsToArchive = await prisma.notification.findMany({
      where: {
        userId: user.id,
        status: {
          notIn: ['archived', 'deleted']
        }
      },
      select: { id: true }
    })

    if (notificationsToArchive.length === 0) {
      return NextResponse.json({ success: true })
    }

    await prisma.notification.updateMany({
      where: {
        id: {
          in: notificationsToArchive.map(notification => notification.id)
        }
      },
      data: {
        status: 'archived'
      }
    })

    notificationsToArchive.forEach(notification => {
      emitNotificationUpdate(user.id, notification.id, 'archived')
    })

    return NextResponse.json({ success: true })
  }
})
