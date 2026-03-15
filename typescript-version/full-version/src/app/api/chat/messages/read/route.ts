import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    const { roomId } = await request.json()

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    // Update all unread messages in the room for the current user
    const result = await prisma.message.updateMany({
      where: {
        roomId: roomId,
        senderId: {
          not: user.id // Messages not sent by current user
        },
        readAt: null // Only unread messages
      },
      data: {
        readAt: new Date()
      }
    })

    logger.info(`📖 Marked ${result.count} messages as read in room ${roomId}`)

    return NextResponse.json({
      success: true,
      updatedCount: result.count
    })
  }
})
