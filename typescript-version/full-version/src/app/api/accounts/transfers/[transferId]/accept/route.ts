import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { accountTransferService } from '@/services/accounts'
import { acceptTransferSchema } from '@/lib/validations/account-schemas'
import { formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'

/**
 * POST /api/accounts/transfers/[transferId]/accept
 * Принять запрос на передачу аккаунта
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
  } catch (error) {
    console.error('[POST /api/accounts/transfers/[transferId]/accept] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}



