import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { accountService } from '@/services/accounts'
import { updateAccountSchema } from '@/lib/validations/account-schemas'
import { formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'

/**
 * GET /api/accounts/[id]
 * Получить аккаунт по ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)
    const { id } = await params

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

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
  } catch (error) {
    console.error('[GET /api/accounts/[id]] Error:', error)
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
 * PUT /api/accounts/[id]
 * Обновить аккаунт
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)
    const { id } = await params

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

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
  } catch (error) {
    console.error('[PUT /api/accounts/[id]] Error:', error)
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
 * DELETE /api/accounts/[id]
 * Удалить аккаунт
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)
    const { id } = await params

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

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
  } catch (error) {
    console.error('[DELETE /api/accounts/[id]] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}



