import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    // Get user's chat rooms
    const userRooms = await (prisma as any).chatRoom.findMany({
      where: {
        OR: [
          { user1Id: user.id },
          { user2Id: user.id }
        ]
      }
    })

    const unreadByContact: { [contactId: string]: number } = {}

    // For each room, count unread messages from the other user
    for (const room of userRooms) {
      const otherUserId = room.user1Id === user.id ? room.user2Id : room.user1Id

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

    // Get all users except current user for status tracking
    const allUsers = await (prisma as any).user.findMany({
      where: {
        id: {
          not: user.id
        }
      },
      select: {
        id: true,
        lastSeen: true
      }
    })

    // Import online users from chat namespace
    const { getOnlineUsers } = await import('@/lib/sockets/namespaces/chat/index')
    const userStatuses = await getOnlineUsers()

    return NextResponse.json({
      unreadByContact,
      userStatuses
    })
  } catch (error) {
    console.error('❌ [API] Ошибка получения непрочитанных сообщений по контактам:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


