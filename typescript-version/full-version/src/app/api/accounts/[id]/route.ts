import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { accountService } from '@/services/accounts'
import { updateAccountSchema } from '@/lib/validations/account-schemas'
import { formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'

/**
 * GET /api/accounts/[id]
 * Получить аккаунт по ID
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id } = params

    const account = await accountService.getAccountById(id, user.id)

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: 'Account not found or access denied'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: account
    })
  }
})

/**
 * PUT /api/accounts/[id]
 * Обновить аккаунт
 */
export const PUT = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    const { id } = params

    const body = await request.json()
    const validationResult = updateAccountSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: formatZodError(validationResult.error)
        },
        { status: 400 }
      )
    }

    const account = await accountService.updateAccount(
      id,
      user.id,
      validationResult.data
    )

    // Логируем событие
    await eventService.record({
      source: 'api',
      module: 'account',
      type: 'account.updated',
      severity: 'info',
      actor: { type: 'user', id: user.id },
      subject: { type: 'account', id: account.id },
      message: `Пользователь ${user.email || user.id} обновил аккаунт ${account.name}`
    })

    return NextResponse.json({
      success: true,
      data: account,
      message: 'Account updated successfully'
    })
  }
})

/**
 * DELETE /api/accounts/[id]
 * Удалить аккаунт
 */
export const DELETE = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id } = params

    // Получаем аккаунт перед удалением для логирования
    const account = await accountService.getAccountById(id, user.id)

    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: 'Account not found or access denied'
        },
        { status: 404 }
      )
    }

    await accountService.deleteAccount(id, user.id)

    // Логируем событие
    await eventService.record({
      source: 'api',
      module: 'account',
      type: 'account.deleted',
      severity: 'warning',
      actor: { type: 'user', id: user.id },
      subject: { type: 'account', id: id },
      message: `Пользователь ${user.email || user.id} удалил аккаунт ${account.name}`
    })

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    })
  }
})
