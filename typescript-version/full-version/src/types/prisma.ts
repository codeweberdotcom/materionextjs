import type { Prisma } from '@prisma/client'

export type UserWithRoleRecord = Prisma.UserGetPayload<{
  include: { role: true }
}>

export type ChatMessageWithSender = Prisma.MessageGetPayload<{
  include: { sender: true }
}>

export type ChatRoomWithParticipants = Prisma.ChatRoomGetPayload<{
  include: {
    user1: true
    user2: true
  }
}>

export type NotificationWithUser = Prisma.NotificationGetPayload<{
  include: {
    user: {
      select: {
        id: true
        email: true
        name: true
      }
    }
  }
}>
