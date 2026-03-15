import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { accountManagerService } from '@/services/accounts'
import { updateManagerPermissionsSchema } from '@/lib/validations/account-schemas'
import { formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'

/**
 * PUT /api/accounts/[id]/managers/[managerId]
 * Обновить права менеджера
 */
export const PUT = withApiHandler<unknown, { id: string; managerId: string }>({
  handler: async ({ user, request, params }) => {
    const { id, managerId } = params

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
      id,
      user.id,
      managerId,
      permissions
    )

    // Логируем событие
    await eventService.record({
      source: 'api',
      module: 'account',
      type: 'manager.updated',
      severity: 'info',
      actor: { type: 'user', id: user.id },
      subject: { type: 'account', id: id },
      message: `Пользователь ${user.email || user.id} обновил права менеджера`,
      payload: {
        managerId: managerId,
        permissions
      }
    })

    return NextResponse.json({
      success: true,
      data: manager,
      message: 'Manager permissions updated successfully'
    })
  }
})

/**
 * DELETE /api/accounts/[id]/managers/[managerId]
 * Отозвать права менеджера
 */
export const DELETE = withApiHandler<unknown, { id: string; managerId: string }>({
  handler: async ({ user, params }) => {
    const { id, managerId } = params

    await accountManagerService.revokeManager(
      id,
      user.id,
      managerId,
      user.id
    )

    // Логируем событие
    await eventService.record({
      source: 'api',
      module: 'account',
      type: 'manager.revoked',
      severity: 'warning',
      actor: { type: 'user', id: user.id },
      subject: { type: 'account', id: id },
      message: `Пользователь ${user.email || user.id} отозвал права менеджера`,
      payload: {
        managerId: managerId
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Manager revoked successfully'
    })
  }
})
