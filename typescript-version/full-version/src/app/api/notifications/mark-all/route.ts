import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { prisma } from '@/libs/prisma'

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { read } = await request.json()

    await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        status: {
          not: 'archived' // Don't update archived notifications
        }
      },
      data: {
        status: 'archived', // Archive all active notifications
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating all notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}