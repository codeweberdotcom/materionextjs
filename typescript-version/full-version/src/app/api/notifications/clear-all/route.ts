import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
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

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
  } catch (error) {
    console.error('Error clearing all notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


