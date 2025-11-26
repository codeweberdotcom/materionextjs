import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { scenarioService } from '@/services/notifications/scenarios'
import type { NotificationScenarioConfig } from '@/services/notifications/scenarios/types'
import logger from '@/lib/logger'

/**
 * GET /api/admin/notification-scenarios
 * Получить список всех сценариев
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверка прав доступа
    if (!checkPermission(user, 'notificationScenarios', 'read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const enabled = request.nextUrl.searchParams.get('enabled')
    const scenarios = await scenarioService.getAll(
      enabled !== null ? enabled === 'true' : undefined
    )

    return NextResponse.json({ scenarios })
  } catch (error) {
    logger.error('[API:NotificationScenarios] Failed to get scenarios', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json(
      { error: 'Failed to get scenarios' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/notification-scenarios
 * Создать новый сценарий
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверка прав доступа
    if (!checkPermission(user, 'notificationScenarios', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json()) as NotificationScenarioConfig
    const scenario = await scenarioService.create(body, user.id)

    return NextResponse.json({ scenario }, { status: 201 })
  } catch (error) {
    logger.error('[API:NotificationScenarios] Failed to create scenario', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json(
      { error: 'Failed to create scenario' },
      { status: 500 }
    )
  }
}



