import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { rateLimitService } from '@/lib/rate-limit'
import type { ChatMessage } from '@/lib/sockets/types/chat'
import { getRequestIp } from '@/utils/http/get-request-ip'

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 30

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
    }

    const limitParam = Number(searchParams.get('limit'))
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(limitParam)))
      : DEFAULT_LIMIT

    const cursor = searchParams.get('cursor')
    const cursorDate = cursor ? new Date(cursor) : null

    if (cursor && Number.isNaN(cursorDate?.getTime())) {
      return NextResponse.json({ error: 'Invalid cursor value' }, { status: 400 })
    }

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { user1Id: true, user2Id: true }
    })

    if (!room || (room.user1Id !== user.id && room.user2Id !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const messages = await prisma.message.findMany({
      where: {
        roomId,
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {})
      },
      include: {
        sender: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1
    })

    const hasMore = messages.length > limit
    const sliced = hasMore ? messages.slice(0, limit) : messages
    const nextCursor = hasMore
      ? sliced[sliced.length - 1]?.createdAt.toISOString()
      : null

    return NextResponse.json({
      items: sliced.reverse().map(message => ({
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        sender: {
          id: message.sender.id,
          name: message.sender.name || undefined,
          email: message.sender.email
        },
        roomId: message.roomId,
        readAt: message.readAt ? message.readAt.toISOString() : null,
        createdAt: message.createdAt.toISOString(),
        clientId: null
      })),
      nextCursor
    })
  } catch (error) {
    console.error('[api/chat/messages] GET error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientIp = getRequestIp(request)
    const rateLimitResult = await rateLimitService.checkLimit(user.id, 'chat-messages', {
      userId: user.id,
      email: user.email ?? null,
      ipAddress: clientIp,
      keyType: 'user'
    })

    if (!rateLimitResult.allowed) {
      const blockedUntilMs = rateLimitResult.blockedUntil ?? rateLimitResult.resetTime
      const retryAfterSec = Math.max(
        1,
        Math.ceil((blockedUntilMs - Date.now()) / 1000)
      )
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          blockedUntilMs,
          retryAfterSec,
          remaining: rateLimitResult.remaining,
          // Legacy для обратной совместимости
          retryAfter: retryAfterSec,
          blockedUntil: blockedUntilMs
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfterSec.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': blockedUntilMs.toString()
          }
        }
      )
    }

    const body = await request.json().catch(() => null)
    const { roomId, message, clientId } = body || {}

    if (!roomId || !message || typeof message !== 'string') {
      return NextResponse.json({ error: 'roomId and message are required' }, { status: 400 })
    }

    const room = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [
          { user1Id: user.id },
          { user2Id: user.id }
        ]
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const newMessage = await prisma.message.create({
      data: {
        content: message,
        senderId: user.id,
        roomId
      },
      include: {
        sender: true
      }
    })

    const messagePayload: ChatMessage = {
      id: newMessage.id,
      content: newMessage.content,
      senderId: newMessage.senderId,
      sender: {
        id: newMessage.sender.id,
        name: newMessage.sender.name || undefined,
        email: newMessage.sender.email
      },
      roomId: newMessage.roomId,
      readAt: newMessage.readAt?.toISOString(),
      createdAt: newMessage.createdAt.toISOString(),
      clientId: clientId ?? undefined
    }

    try {
      const io = globalThis.io
      if (io?.of) {
        io.of('/chat').to(`room_${roomId}`).emit('receiveMessage', messagePayload)
      }
    } catch (error) {
      console.warn('[api/chat/messages] failed to emit via socket', error)
    }

    return NextResponse.json({
      message: messagePayload,
      warning: rateLimitResult.warning || null,
      rateLimit: {
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime
      }
    })
  } catch (error) {
    console.error('[api/chat/messages] POST error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
