import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { accountTransferService } from '@/services/accounts'
import { rejectTransferSchema } from '@/lib/validations/account-schemas'
import { formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'

/**
 * POST /api/accounts/transfers/[transferId]/reject
 * Отклонить запрос на передачу аккаунта
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { transferId: string } }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

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
      params.transferId,
      user.id,
      reason
    )

    // Логируем событие
    await eventService.create({
      source: 'api',
      module: 'account',
      type: 'transfer.rejected',
      severity: 'info',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'account',
      subjectId: transfer.fromAccountId,
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
  } catch (error) {
    console.error('[POST /api/accounts/transfers/[transferId]/reject] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}


