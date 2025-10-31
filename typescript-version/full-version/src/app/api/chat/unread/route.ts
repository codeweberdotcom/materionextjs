import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

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