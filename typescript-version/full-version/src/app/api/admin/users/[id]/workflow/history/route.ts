/**
 * API: User Workflow History
 *
 * GET /api/admin/users/[id]/workflow/history - Получить историю переходов
 */

import { NextRequest, NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { userWorkflowService } from '@/services/workflows/UserWorkflowService'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/users/[id]/workflow/history
 *
 * Получить историю переходов пользователя
 *
 * Query params:
 * - limit: number (по умолчанию 50)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }

    const { id: userId } = await params
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
  } catch (error) {
    console.error('[API] GET /api/admin/users/[id]/workflow/history error:', error)

    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}


