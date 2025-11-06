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

    return NextResponse.json(unreadByContact)
  } catch (error) {
    console.error('вќЊ [API] РћС€РёР±РєР° РїРѕР»СѓС‡РµРЅРёСЏ РЅРµРїСЂРѕС‡РёС‚Р°РЅРЅС‹С… СЃРѕРѕР±С‰РµРЅРёР№ РїРѕ РєРѕРЅС‚Р°РєС‚Р°Рј:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


