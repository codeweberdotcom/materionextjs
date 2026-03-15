import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { accountManagerService } from '@/services/accounts'
import { assignManagerSchema } from '@/lib/validations/account-schemas'
import { formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'

/**
 * GET /api/accounts/[id]/managers
 * Получить список менеджеров аккаунта
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id } = params

    const managers = await accountManagerService.getAccountManagers(id, user.id)

    return NextResponse.json({
      success: true,
      data: managers
    })
  }
})

/**
 * POST /api/accounts/[id]/managers
 * Назначить менеджера для аккаунта
 */
export const POST = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    const { id } = params

    const body = await request.json()
    const validationResult = assignManagerSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: formatZodError(validationResult.error)
        },
        { status: 400 }
      )
    }

    const { userId, permissions } = validationResult.data

    const manager = await accountManagerService.assignManager(
      id,
      user.id,
      userId,
      permissions,
      user.id
    )

    // Логируем событие
    await eventService.record({
      source: 'api',
      module: 'account',
      type: 'manager.assigned',
      severity: 'info',
      actor: { type: 'user', id: user.id },
      subject: { type: 'account', id: id },
      message: `Пользователь ${user.email || user.id} назначил менеджера для аккаунта`,
      payload: {
        managerUserId: userId,
        permissions
      }
    })

    return NextResponse.json({
      success: true,
      data: manager,
      message: 'Manager assigned successfully'
    }, { status: 201 })
  }
})
