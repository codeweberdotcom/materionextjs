/**
 * API endpoint для отклонения документов пользователя (admin only)
 * POST /api/admin/users/[id]/reject-documents
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/libs/prisma'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission, isSuperadmin } from '@/utils/permissions/permissions'
import { eventService } from '@/services/events'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

const rejectDocumentsSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long')
})

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

    // Валидация тела запроса
    const body = await request.json()
    const validationResult = rejectDocumentsSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { message: 'Validation error', errors: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { reason } = validationResult.data

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

    // Отклоняем документы
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        documentsVerified: null,
        documentsVerifiedBy: null,
        documentsRejectedAt: new Date(),
        documentsRejectedReason: reason
      },
      include: { role: true }
    })

    // Записываем событие
    await eventService.record(enrichEventInputFromRequest(request, {
      eventType: 'DOCUMENTS_REJECTED',
      actorId: adminUser.id,
      targetId: userId,
      details: {
        userId: userId,
        userName: targetUser.name,
        rejectedBy: adminUser.id,
        rejectedByName: adminUser.name,
        reason: reason
      }
    }))

    // Трансформируем ответ
    const { password: _, ...userWithoutPassword } = updatedUser

    return NextResponse.json({
      message: 'Documents rejected',
      user: {
        ...userWithoutPassword,
        documentsStatus: 'rejected'
      }
    })
  } catch (error) {
    console.error('Error rejecting documents:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}




