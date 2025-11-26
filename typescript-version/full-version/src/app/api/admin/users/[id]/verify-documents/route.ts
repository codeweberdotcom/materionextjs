/**
 * API endpoint для подтверждения документов пользователя (admin only)
 * POST /api/admin/users/[id]/verify-documents
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission, isSuperadmin } from '@/utils/permissions/permissions'
import { eventService } from '@/services/events'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: adminUser } = await requireAuth(request)

    if (!adminUser) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Проверяем права на управление пользователями
    if (!isSuperadmin(adminUser) && !checkPermission(adminUser, 'userManagement', 'update')) {
      return NextResponse.json(
        { message: 'Forbidden: insufficient permissions' },
        { status: 403 }
      )
    }

    const { id: userId } = await params

    // Получаем пользователя
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    })

    if (!targetUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Проверяем, что документы еще не подтверждены
    if (targetUser.documentsVerified) {
      return NextResponse.json(
        { message: 'Documents already verified' },
        { status: 400 }
      )
    }

    // Подтверждаем документы
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        documentsVerified: new Date(),
        documentsVerifiedBy: adminUser.id,
        documentsRejectedAt: null,
        documentsRejectedReason: null
      },
      include: { role: true }
    })

    // Записываем событие
    await eventService.record(enrichEventInputFromRequest(request, {
      eventType: 'DOCUMENTS_VERIFIED',
      actorId: adminUser.id,
      targetId: userId,
      details: {
        userId: userId,
        userName: targetUser.name,
        verifiedBy: adminUser.id,
        verifiedByName: adminUser.name
      }
    }))

    // Трансформируем ответ
    const { password: _, ...userWithoutPassword } = updatedUser

    return NextResponse.json({
      message: 'Documents verified successfully',
      user: {
        ...userWithoutPassword,
        documentsStatus: 'verified'
      }
    })
  } catch (error) {
    console.error('Error verifying documents:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}





