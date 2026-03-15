import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { accountTransferService } from '@/services/accounts'
import { rejectTransferSchema } from '@/lib/validations/account-schemas'
import { formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'

/**
 * POST /api/accounts/transfers/[transferId]/reject
 * Отклонить запрос на передачу аккаунта
 */
export const POST = withApiHandler<unknown, { transferId: string }>({
  handler: async ({ user, request, params }) => {
    const { transferId } = params

    const body = await request.json().catch(() => ({}))
    const validationResult = rejectTransferSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: formatZodError(validationResult.error)
        },
        { status: 400 }
      )
    }

    const { reason } = validationResult.data || {}

    const transfer = await accountTransferService.rejectTransfer(
      transferId,
      user.id,
      reason
    )

    // Логируем событие
    await eventService.record({
      source: 'api',
      module: 'account',
      type: 'transfer.rejected',
      severity: 'info',
      actor: { type: 'user', id: user.id },
      subject: { type: 'account', id: transfer.fromAccountId },
      message: `Пользователь ${user.email || user.id} отклонил передачу аккаунта`,
      payload: {
        transferId: transfer.id,
        reason
      }
    })

    return NextResponse.json({
      success: true,
      data: transfer,
      message: 'Transfer rejected successfully'
    })
  }
})
