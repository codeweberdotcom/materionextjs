import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получаем количество уникальных пользователей с активными сессиями
    const activeUsers = await prisma.session.findMany({
      where: {
        expiresAt: {
          gt: new Date() // expiresAt > now()
        }
      },
      select: {
        userId: true
      },
      distinct: ['userId'] // Получаем уникальных пользователей
    })

    const activeUsersCount = activeUsers.length

    return NextResponse.json({
      activeUsers: activeUsersCount
    })
  } catch (error) {
    console.error('Error fetching active users count:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}