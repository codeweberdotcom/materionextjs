import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { rateLimitService } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId: otherUserId } = await request.json()

    if (!otherUserId || otherUserId === user.id) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Rate limit check
    const rateLimitResult = await rateLimitService.checkLimit(user.id, 'chat-rooms', {
      userId: user.id,
      email: user.email ?? null,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      keyType: 'user'
    })

    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000)
      }, { status: 429 })
    }

    // Check if current user can access the other user
    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, name: true, email: true }
    })

    if (!otherUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find existing room
    let room = await prisma.chatRoom.findFirst({
      where: {
        OR: [
          { user1Id: user.id, user2Id: otherUserId },
          { user1Id: otherUserId, user2Id: user.id }
        ]
      }
    })

    // Create room if it doesn't exist
    if (!room) {
      room = await prisma.chatRoom.create({
        data: {
          user1Id: user.id,
          user2Id: otherUserId
        }
      })
    }

    // Get recent messages
    const messages = await prisma.message.findMany({
      where: { roomId: room.id },
      include: { sender: true },
      orderBy: { createdAt: 'desc' },
      take: 30
    })

    const normalizedMessages = messages
      .map(msg => ({
        id: msg.id,
        content: msg.content,
        senderId: msg.senderId,
        sender: {
          id: msg.sender.id,
          name: msg.sender.name || undefined,
          email: msg.sender.email
        },
        roomId: msg.roomId,
        readAt: msg.readAt ? msg.readAt.toISOString() : undefined,
        createdAt: msg.createdAt.toISOString()
      }))
      .reverse() // Reverse to chronological order

    const roomData = {
      room: {
        id: room.id,
        user1Id: room.user1Id,
        user2Id: room.user2Id,
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString()
      },
      messages: normalizedMessages,
      nextCursor: messages.length === 30 ? messages[0]?.createdAt.toISOString() : null
    }

    return NextResponse.json(roomData)
  } catch (error) {
    console.error('Failed to create/get room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
