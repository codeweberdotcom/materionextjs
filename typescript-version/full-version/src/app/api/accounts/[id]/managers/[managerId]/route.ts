import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { accountManagerService } from '@/services/accounts'
import { updateManagerPermissionsSchema } from '@/lib/validations/account-schemas'
import { formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'

/**
 * PUT /api/accounts/[id]/managers/[managerId]
 * Обновить права менеджера
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; managerId: string } }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validationResult = updateManagerPermissionsSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: formatZodError(validationResult.error)
        },
        { status: 400 }
      )
    }

    const { permissions } = validationResult.data

    const manager = await accountManagerService.updateManagerPermissions(
      params.id,
      user.id,
      params.managerId,
      permissions
    )

    // Логируем событие
    await eventService.create({
      source: 'api',
      module: 'account',
      type: 'manager.updated',
      severity: 'info',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'account',
      subjectId: params.id,
      message: `Пользователь ${user.email || user.id} обновил права менеджера`,
      payload: {
        managerId: params.managerId,
        permissions
      }
    })

    return NextResponse.json({
      success: true,
      data: manager,
      message: 'Manager permissions updated successfully'
    })
  } catch (error) {
    console.error('[PUT /api/accounts/[id]/managers/[managerId]] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/accounts/[id]/managers/[managerId]
 * Отозвать права менеджера
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; managerId: string } }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    await accountManagerService.revokeManager(
      params.id,
      user.id,
      params.managerId,
      user.id
    )

    // Логируем событие
    await eventService.create({
      source: 'api',
      module: 'account',
      type: 'manager.revoked',
      severity: 'warning',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'account',
      subjectId: params.id,
      message: `Пользователь ${user.email || user.id} отозвал права менеджера`,
      payload: {
        managerId: params.managerId
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Manager revoked successfully'
    })
  } catch (error) {
    console.error('[DELETE /api/accounts/[id]/managers/[managerId]] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}



