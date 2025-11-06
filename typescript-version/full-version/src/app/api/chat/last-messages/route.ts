import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's chat rooms
    const userRooms = await (prisma as any).chatRoom.findMany({
      where: {
        OR: [
          { user1Id: user.id },
          { user2Id: user.id }
        ]
      }
    })

    if (userRooms.length === 0) {
      return NextResponse.json([])
    }

    // Get the last message from each chat room
    const lastMessages = []

    for (const room of userRooms) {
      const message = await (prisma as any).message.findFirst({
        where: { roomId: room.id },
        include: { sender: true },
        orderBy: { createdAt: 'desc' }
      })

      if (message) {
        // Определяем получателя: другой пользователь в комнате
        const receiverId = room.user1Id === message.senderId ? room.user2Id : room.user1Id

        lastMessages.push({
          id: message.id,
          content: message.content,
          senderId: message.senderId,
          receiverId: receiverId,
          roomId: message.roomId,
          createdAt: message.createdAt
        })
      }
    }

    // Если сообщений нет, создаем пустые записи для комнат с другими пользователями
    if (lastMessages.length === 0) {
      for (const room of userRooms) {
        const otherUserId = room.user1Id === user.id ? room.user2Id : room.user1Id

        lastMessages.push({
          id: `empty-${room.id}`,
          content: '',
          senderId: otherUserId, // Отправитель - другой пользователь
          receiverId: user.id, // Получатель - текущий пользователь
          roomId: room.id,
          createdAt: room.createdAt.toISOString()
        })
      }
    }

    return NextResponse.json(lastMessages)
  } catch (error) {
    console.error('❌ [API] Ошибка получения последних сообщений:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}