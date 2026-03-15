import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { accountTransferService } from '@/services/accounts'
import { eventService } from '@/services/events/EventService'

/**
 * POST /api/accounts/transfers/[transferId]/cancel
 * Отменить запрос на передачу аккаунта
 */
export const POST = withApiHandler<unknown, { transferId: string }>({
  handler: async ({ user, params }) => {
    const { transferId } = params

    const transfer = await accountTransferService.cancelTransfer(
      transferId,
      user.id
    )

    // Логируем событие
    await eventService.record({
      source: 'api',
      module: 'account',
      type: 'transfer.cancelled',
      severity: 'info',
      actor: { type: 'user', id: user.id },
      subject: { type: 'account', id: transfer.fromAccountId },
      message: `Пользователь ${user.email || user.id} отменил запрос на передачу аккаунта`,
      payload: {
        transferId: transfer.id
      }
    })

    return NextResponse.json({
      success: true,
      data: transfer,
      message: 'Transfer cancelled successfully'
    })
  }
})
