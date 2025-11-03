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
        const otherUserId = room.user1Id === session.user.id ? room.user2Id : room.user1Id

        lastMessages.push({
          id: `empty-${room.id}`,
          content: '',
          senderId: otherUserId, // Отправитель - другой пользователь
          receiverId: session.user.id, // Получатель - текущий пользователь
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