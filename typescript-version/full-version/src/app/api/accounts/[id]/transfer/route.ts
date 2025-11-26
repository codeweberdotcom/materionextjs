import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { accountTransferService } from '@/services/accounts'
import { transferAccountSchema } from '@/lib/validations/account-schemas'
import { formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'

/**
 * POST /api/accounts/[id]/transfer
 * Запросить передачу аккаунта другому пользователю
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

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
      params.id,
      user.id,
      toUserId,
      user.id
    )

    // Логируем событие
    await eventService.create({
      source: 'api',
      module: 'account',
      type: 'transfer.requested',
      severity: 'info',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'account',
      subjectId: params.id,
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
  } catch (error) {
    console.error('[POST /api/accounts/[id]/transfer] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/accounts/[id]/transfer
 * Получить статус передачи аккаунта
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Получаем запросы на передачу для пользователя
    const transfers = await accountTransferService.getTransferRequests(user.id)

    // Находим запрос для этого аккаунта
    const transfer = [...transfers.incoming, ...transfers.outgoing].find(
      t => t.fromAccountId === params.id
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
  } catch (error) {
    console.error('[GET /api/accounts/[id]/transfer] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}


