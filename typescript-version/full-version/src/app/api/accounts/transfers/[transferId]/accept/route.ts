import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { accountTransferService } from '@/services/accounts'
import { acceptTransferSchema } from '@/lib/validations/account-schemas'
import { formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'

/**
 * POST /api/accounts/transfers/[transferId]/accept
 * Принять запрос на передачу аккаунта
 */
export const POST = withApiHandler<unknown, { transferId: string }>({
  handler: async ({ user, request, params }) => {
    const { transferId } = params

    const body = await request.json().catch(() => ({}))
    const validationResult = acceptTransferSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: formatZodError(validationResult.error)
        },
        { status: 400 }
      )
    }

    const transfer = await accountTransferService.acceptTransfer(
      transferId,
      user.id
    )

    // Логируем событие
    await eventService.record({
      source: 'api',
      module: 'account',
      type: 'transfer.accepted',
      severity: 'info',
      actor: { type: 'user', id: user.id },
      subject: { type: 'account', id: transfer.fromAccountId },
      message: `Пользователь ${user.email || user.id} принял передачу аккаунта`,
      payload: {
        transferId: transfer.id
      }
    })

    return NextResponse.json({
      success: true,
      data: transfer,
      message: 'Transfer accepted successfully'
    })
  }
})
