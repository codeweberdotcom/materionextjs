import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { prisma } from '@/libs/prisma'

export const GET = withApiHandler({
  handler: async ({ user }) => {
    const userId = user.id

    // Count unread messages for the current user
    const unreadCount = await prisma.message.count({
      where: {
        AND: [
          { senderId: { not: userId } }, // Messages not sent by current user
          { readAt: null }, // Messages that haven't been read
          {
            room: {
              OR: [
                { user1Id: userId }, // User is user1 in the room
                { user2Id: userId }  // User is user2 in the room
              ]
            }
          }
        ]
      }
    })

    return NextResponse.json({ count: unreadCount })
  }
})
