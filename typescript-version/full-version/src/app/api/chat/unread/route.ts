import { NextRequest, NextResponse } from 'next/server'
import { lucia } from '@/libs/lucia'
import { prisma } from '@/libs/prisma'

export async function GET(request: NextRequest) {
  try {
    const sessionId = lucia.readSessionCookie(request.headers.get('cookie') ?? '')
    const { session, user } = await lucia.validateSession(sessionId || '')

    if (!session || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
  } catch (error) {
    console.error('Error fetching unread messages count:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


