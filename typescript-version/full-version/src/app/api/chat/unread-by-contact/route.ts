import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [API] Запрос непрочитанных сообщений по контактам')

    const session = await getServerSession(authOptions)
    console.log('👤 [API] Сессия пользователя:', session?.user?.id)

    if (!session?.user?.id) {
      console.log('❌ [API] Пользователь не авторизован')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's chat rooms
    console.log('🏠 [API] Поиск чат-комнат пользователя')
    const userRooms = await (prisma as any).chatRoom.findMany({
      where: {
        OR: [
          { user1Id: session.user.id },
          { user2Id: session.user.id }
        ]
      }
    })
    console.log('📋 [API] Найдено комнат:', userRooms.length)

    const unreadByContact: { [contactId: string]: number } = {}

    // For each room, count unread messages from the other user
    for (const room of userRooms) {
      const otherUserId = room.user1Id === session.user.id ? room.user2Id : room.user1Id

      console.log('🔎 [API] Подсчет непрочитанных сообщений в комнате:', room.id, 'от пользователя:', otherUserId)

      const unreadCount = await (prisma as any).message.count({
        where: {
          roomId: room.id,
          senderId: otherUserId, // Messages from the other user
          readAt: null // Not read yet
        }
      })

      if (unreadCount > 0) {
        unreadByContact[otherUserId] = unreadCount
        console.log('📝 [API] Непрочитанных сообщений от', otherUserId, ':', unreadCount)
      }
    }

    console.log('✅ [API] Возвращаем непрочитанные сообщения по контактам:', unreadByContact)
    return NextResponse.json(unreadByContact)
  } catch (error) {
    console.error('❌ [API] Ошибка получения непрочитанных сообщений по контактам:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}