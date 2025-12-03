/**
 * API endpoint для получения списка пользователей, ожидающих подтверждения документов
 * GET /api/admin/users/pending-verification
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission, isSuperadmin } from '@/utils/permissions/permissions'
import { getDocumentsStatus } from '@/utils/verification/verification-levels'

export async function GET(request: NextRequest) {
  try {
    const { user: adminUser } = await requireAuth(request)

    if (!adminUser) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Проверяем права на просмотр пользователей
    if (!isSuperadmin(adminUser) && !checkPermission(adminUser, 'userManagement', 'read')) {
      return NextResponse.json(
        { message: 'Forbidden: insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending' // pending | rejected | verified | all
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Строим условие фильтрации
    let whereCondition: any = {}

    if (status === 'pending') {
      // Пользователи с загруженными документами, но не подтвержденные
      whereCondition = {
        documentsVerified: null,
        documentsRejectedAt: null,
        image: { not: null } // Есть фото/документ
      }
    } else if (status === 'rejected') {
      whereCondition = {
        documentsRejectedAt: { not: null }
      }
    } else if (status === 'verified') {
      whereCondition = {
        documentsVerified: { not: null }
      }
    }
    // status === 'all' - без фильтра

    // Получаем пользователей
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereCondition,
        include: { role: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.user.count({ where: whereCondition })
    ])

    // Трансформируем данные
    const transformedUsers = users.map(user => {
      const { password: _, ...userWithoutPassword } = user
      return {
        ...userWithoutPassword,
        documentsStatus: getDocumentsStatus(user)
      }
    })

    return NextResponse.json({
      users: transformedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching pending verification users:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}





