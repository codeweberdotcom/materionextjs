import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { accountTransferService } from '@/services/accounts'

/**
 * GET /api/accounts/transfers
 * Получить все запросы на передачу аккаунтов (входящие и исходящие)
 */
export const GET = withApiHandler({
  handler: async ({ user }) => {
    const transfers = await accountTransferService.getTransferRequests(user.id)

    return NextResponse.json({
      success: true,
      data: transfers
    })
  }
})
