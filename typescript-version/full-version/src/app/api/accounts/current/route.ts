import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { accountAccessService } from '@/services/accounts'

/**
 * GET /api/accounts/current
 * Получить текущий выбранный аккаунт пользователя
 */
export const GET = withApiHandler({
  handler: async ({ user }) => {
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
  }
})
