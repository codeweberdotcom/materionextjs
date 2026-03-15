import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { prisma } from '@/libs/prisma'

export const GET = withApiHandler({
  handler: async ({ user }) => {
    // Get user's chat rooms
    const userRooms = await prisma.chatRoom.findMany({
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
      const message = await prisma.message.findFirst({
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

    // Если сообщений нет, создаём пустые записи для комнат с другими пользователями
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
  }
})
