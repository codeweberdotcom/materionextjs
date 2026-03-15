import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { accountService } from '@/services/accounts'
import { createAccountSchema } from '@/lib/validations/account-schemas'
import { formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'

/**
 * GET /api/accounts
 * Получить список всех аккаунтов пользователя
 */
export const GET = withApiHandler({
  handler: async ({ user }) => {
    const accounts = await accountService.getUserAccounts(user.id)

    return NextResponse.json({
      success: true,
      data: accounts
    })
  }
})

/**
 * POST /api/accounts
 * Создать новый аккаунт
 */
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    const body = await request.json()
    const validationResult = createAccountSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: formatZodError(validationResult.error)
        },
        { status: 400 }
      )
    }

    const { type, name, description, tariffPlanCode } = validationResult.data

    const account = await accountService.createAccountWithData(user.id, {
      type,
      name,
      description,
      tariffPlanCode
    })

    // Логируем событие
    await eventService.record({
      source: 'api',
      module: 'account',
      type: 'account.created',
      severity: 'info',
      actor: { type: 'user', id: user.id },
      subject: { type: 'account', id: account.id },
      message: `Пользователь ${user.email || user.id} создал аккаунт ${account.name}`,
      payload: {
        accountType: type,
        tariffPlanCode: tariffPlanCode || 'FREE'
      }
    })

    return NextResponse.json({
      success: true,
      data: account,
      message: 'Account created successfully'
    }, { status: 201 })
  }
})
