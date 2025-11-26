import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { accountService, accountAccessService } from '@/services/accounts'
import { eventService } from '@/services/events/EventService'

/**
 * POST /api/accounts/[id]/switch
 * Переключиться на аккаунт (установить как текущий)
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

    // Проверяем доступ к аккаунту
    const hasAccess = await accountAccessService.canAccessAccount(user.id, params.id)
    if (!hasAccess) {
      return NextResponse.json(
        {
          success: false,
          message: 'Access denied to this account'
        },
        { status: 403 }
      )
    }

    // Получаем аккаунт
    const account = await accountService.getAccountById(params.id, user.id)
    if (!account) {
      return NextResponse.json(
        {
          success: false,
          message: 'Account not found'
        },
        { status: 404 }
      )
    }

    // Устанавливаем текущий аккаунт (TODO: сохранить в сессию/контекст)
    await accountAccessService.setCurrentAccount(user.id, params.id)

    // Логируем событие
    await eventService.create({
      source: 'api',
      module: 'account',
      type: 'account.switched',
      severity: 'info',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'account',
      subjectId: account.id,
      message: `Пользователь ${user.email || user.id} переключился на аккаунт ${account.name}`
    })

    return NextResponse.json({
      success: true,
      data: account,
      message: 'Account switched successfully'
    })
  } catch (error) {
    console.error('[POST /api/accounts/[id]/switch] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}


