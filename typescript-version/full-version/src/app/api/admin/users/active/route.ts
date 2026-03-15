import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { prisma } from '@/libs/prisma'

export const GET = withApiHandler({
  handler: async () => {
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
  }
})
