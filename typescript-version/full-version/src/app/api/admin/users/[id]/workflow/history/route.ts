/**
 * API: User Workflow History
 *
 * GET /api/admin/users/[id]/workflow/history - Получить историю переходов
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { userWorkflowService } from '@/services/workflows/UserWorkflowService'

/**
 * GET /api/admin/users/[id]/workflow/history
 *
 * Получить историю переходов пользователя
 *
 * Query params:
 * - limit: number (по умолчанию 50)
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ request, params }) => {
    const { id: userId } = params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const history = await userWorkflowService.getTransitionHistory(userId, limit)

    return NextResponse.json({
      success: true,
      history: history.map(transition => ({
        id: transition.id,
        fromState: transition.fromState,
        toState: transition.toState,
        event: transition.event,
        actorId: transition.actorId,
        actorType: transition.actorType,
        metadata: transition.metadata ? JSON.parse(transition.metadata) : null,
        createdAt: transition.createdAt
      })),
      total: history.length
    })
  }
})
