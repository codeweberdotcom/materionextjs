import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { accountTransferService } from '@/services/accounts'

/**
 * GET /api/accounts/transfers
 * Получить все запросы на передачу аккаунтов (входящие и исходящие)
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

    const transfers = await accountTransferService.getTransferRequests(user.id)

    return NextResponse.json({
      success: true,
      data: transfers
    })
  } catch (error) {
    console.error('[GET /api/accounts/transfers] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}



