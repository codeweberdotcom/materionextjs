import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { prisma } from '@/libs/prisma'
import { getSocketServer } from '@/lib/sockets'
import { parseNotificationMetadata, serializeNotificationMetadata } from '@/utils/notifications/metadata'

const emitNotificationEvent = (userId: string, event: string, payload: any) => {
  const io = getSocketServer()

  if (!io) return

  const namespace = io.of('/notifications')

  namespace.to(`user_${userId}`).emit(event, payload)

  const legacyMap: Record<string, string> = {
    notificationUpdate: 'notification-update',
    notificationDeleted: 'notification-deleted'
  }

  if (legacyMap[event]) {
    namespace.to(`user_${userId}`).emit(legacyMap[event], payload)
  }
}

export const PATCH = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    const { id } = params
    const body = await request.json()
    const { status, metadata } = body

    const existingNotification = await prisma.notification.findFirst({
      where: {
        id,
        userId: user.id
      }
    })

    if (!existingNotification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    const data: Record<string, any> = {}

    if (status) {
      data.status = status
      data.readAt = status === 'read' ? new Date() : null
    }

    if (metadata !== undefined) {
      data.metadata = serializeNotificationMetadata(metadata)
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data
    })

    emitNotificationEvent(user.id, 'notificationUpdate', {
      notificationId: id,
      updates: {
        status: updatedNotification.status,
        readAt: updatedNotification.readAt ? updatedNotification.readAt.toISOString() : null,
        metadata: parseNotificationMetadata(updatedNotification.metadata)
      },
      userId: user.id
    })

    return NextResponse.json({ success: true })
  }
})

export const DELETE = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id } = params

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId: user.id
      }
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    await prisma.notification.delete({
      where: { id }
    })

    emitNotificationEvent(user.id, 'notificationDeleted', {
      notificationId: id,
      userId: user.id
    })

    return NextResponse.json({ success: true })
  }
})
