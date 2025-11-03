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

    // Get user's chat rooms
    const userRooms = await (prisma as any).chatRoom.findMany({
      where: {
        OR: [
          { user1Id: session.user.id },
          { user2Id: session.user.id }
        ]
      }
    })

    const unreadByContact: { [contactId: string]: number } = {}

    // For each room, count unread messages from the other user
    for (const room of userRooms) {
      const otherUserId = room.user1Id === session.user.id ? room.user2Id : room.user1Id

      const unreadCount = await (prisma as any).message.count({
        where: {
          roomId: room.id,
          senderId: otherUserId, // Messages from the other user
          readAt: null // Not read yet
        }
      })

      if (unreadCount > 0) {
        unreadByContact[otherUserId] = unreadCount
      }
    }

    return NextResponse.json(unreadByContact)
  } catch (error) {
    console.error('❌ [API] Ошибка получения непрочитанных сообщений по контактам:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}