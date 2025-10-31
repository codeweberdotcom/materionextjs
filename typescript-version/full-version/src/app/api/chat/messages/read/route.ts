import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { prisma } from '@/libs/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = await request.json()

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    // Update all unread messages in the room for the current user
    const result = await prisma.message.updateMany({
      where: {
        roomId: roomId,
        senderId: {
          not: session.user.id // Messages not sent by current user
        },
        readAt: null // Only unread messages
      },
      data: {
        readAt: new Date()
      }
    })

    console.log(`📖 Marked ${result.count} messages as read in room ${roomId}`)

    return NextResponse.json({
      success: true,
      updatedCount: result.count
    })

  } catch (error) {
    console.error('Error marking messages as read:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}