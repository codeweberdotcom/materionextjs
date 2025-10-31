import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [API] Запрос последних сообщений')

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

    if (userRooms.length === 0) {
      console.log('📭 [API] У пользователя нет чат-комнат')
      return NextResponse.json([])
    }

    // Get the last message from each chat room
    console.log('💬 [API] Поиск последних сообщений в комнатах')
    const lastMessages = []

    for (const room of userRooms) {
      console.log('🔎 [API] Поиск сообщений в комнате:', room.id)
      const message = await (prisma as any).message.findFirst({
        where: { roomId: room.id },
        include: { sender: true },
        orderBy: { createdAt: 'desc' }
      })

      if (message) {
        console.log('📝 [API] Найдено сообщение:', message.content.substring(0, 50) + '...')
        // Определяем получателя: другой пользователь в комнате
        const receiverId = room.user1Id === message.senderId ? room.user2Id : room.user1Id

        console.log('🔄 [API] Комната:', { user1Id: room.user1Id, user2Id: room.user2Id })
        console.log('👤 [API] Сообщение от:', message.senderId, 'Получатель:', receiverId)

        lastMessages.push({
          id: message.id,
          content: message.content,
          senderId: message.senderId,
          receiverId: receiverId,
          roomId: message.roomId,
          createdAt: message.createdAt
        })
      } else {
        console.log('📭 [API] Сообщений в комнате нет')
      }
    }

    // Если сообщений нет, создаем пустые записи для комнат с другими пользователями
    if (lastMessages.length === 0) {
      console.log('📭 [API] Нет сообщений, создаем пустые записи для всех комнат пользователя')

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

        console.log('📝 [API] Создана пустая запись для комнаты:', {
          roomId: room.id,
          otherUserId: otherUserId,
          currentUserId: session.user.id
        })
      }
    }

    console.log('✅ [API] Возвращаем', lastMessages.length, 'последних сообщений')
    return NextResponse.json(lastMessages)
  } catch (error) {
    console.error('❌ [API] Ошибка получения последних сообщений:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}