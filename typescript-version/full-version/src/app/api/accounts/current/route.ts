import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { accountAccessService } from '@/services/accounts'

/**
 * GET /api/accounts/current
 * Получить текущий выбранный аккаунт пользователя
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const currentAccount = await accountAccessService.getCurrentAccount(user.id)

    if (!currentAccount) {
      return NextResponse.json(
        {
          success: false,
          message: 'No current account selected'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: currentAccount
    })
  } catch (error) {
    console.error('[GET /api/accounts/current] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}



