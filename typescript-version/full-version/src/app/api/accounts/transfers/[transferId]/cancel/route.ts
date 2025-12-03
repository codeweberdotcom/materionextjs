import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { accountTransferService } from '@/services/accounts'
import { eventService } from '@/services/events/EventService'

/**
 * POST /api/accounts/transfers/[transferId]/cancel
 * Отменить запрос на передачу аккаунта
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ transferId: string }> }
) {
  try {
    const { user } = await requireAuth(request)
    const { transferId } = await params

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

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
  } catch (error) {
    console.error('[POST /api/accounts/transfers/[transferId]/cancel] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}



