/**
 * API endpoint для подтверждения документов пользователя (admin only)
 * POST /api/admin/users/[id]/verify-documents
 */

import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withApiHandler } from '@/lib/api/withApiHandler'
import { eventService } from '@/services/events'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

export const POST = withApiHandler<unknown, { id: string }>({
  permission: 'userManagement.update',
  handler: async ({ user: adminUser, request, params }) => {
    const { id: userId } = params

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
      source: 'admin',
      module: 'users',
      type: 'user.documents_verified',
      severity: 'info',
      message: `Documents verified for user ${targetUser.name || targetUser.email}`,
      actor: { type: 'user', id: adminUser.id },
      subject: { type: 'user', id: userId },
      payload: {
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
  }
})
