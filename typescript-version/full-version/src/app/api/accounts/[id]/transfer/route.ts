import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { accountTransferService } from '@/services/accounts'
import { transferAccountSchema } from '@/lib/validations/account-schemas'
import { formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'

/**
 * POST /api/accounts/[id]/transfer
 * Запросить передачу аккаунта другому пользователю
 */
export const POST = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    const { id } = params

    const body = await request.json()
    const validationResult = transferAccountSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: formatZodError(validationResult.error)
        },
        { status: 400 }
      )
    }

    const { toUserId } = validationResult.data

    const transfer = await accountTransferService.requestTransfer(
      id,
      user.id,
      toUserId,
      user.id
    )

    // Логируем событие
    await eventService.record({
      source: 'api',
      module: 'account',
      type: 'transfer.requested',
      severity: 'info',
      actor: { type: 'user', id: user.id },
      subject: { type: 'account', id: id },
      message: `Пользователь ${user.email || user.id} запросил передачу аккаунта`,
      payload: {
        toUserId,
        transferId: transfer.id
      }
    })

    return NextResponse.json({
      success: true,
      data: transfer,
      message: 'Transfer request created successfully'
    }, { status: 201 })
  }
})

/**
 * GET /api/accounts/[id]/transfer
 * Получить статус передачи аккаунта
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id } = params

    // Получаем запросы на передачу для пользователя
    const transfers = await accountTransferService.getTransferRequests(user.id)

    // Находим запрос для этого аккаунта
    const transfer = [...transfers.incoming, ...transfers.outgoing].find(
      t => t.fromAccountId === id
    )

    if (!transfer) {
      return NextResponse.json(
        {
          success: false,
          message: 'Transfer request not found'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: transfer
    })
  }
})
