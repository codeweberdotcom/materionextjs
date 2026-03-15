import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { checkPermission } from '@/utils/permissions/permissions'
import { scenarioService } from '@/services/notifications/scenarios'
import type { NotificationScenarioConfig } from '@/services/notifications/scenarios/types'

/**
 * GET /api/admin/notification-scenarios
 * Получить список всех сценариев
 */
export const GET = withApiHandler({
  handler: async ({ user, request }) => {
    if (!checkPermission(user, 'notificationScenarios', 'read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const enabled = request.nextUrl.searchParams.get('enabled')

    const scenarios = await scenarioService.getAll(
      enabled !== null ? enabled === 'true' : undefined
    )

    return NextResponse.json({ scenarios })
  }
})

/**
 * POST /api/admin/notification-scenarios
 * Создать новый сценарий
 */
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    if (!checkPermission(user, 'notificationScenarios', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json()) as NotificationScenarioConfig
    const scenario = await scenarioService.create(body, user.id)

    return NextResponse.json({ scenario }, { status: 201 })
  }
})
