import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { checkPermission } from '@/utils/permissions/permissions'
import { scenarioService } from '@/services/notifications/scenarios'
import type { NotificationScenarioConfig } from '@/services/notifications/scenarios/types'

/**
 * GET /api/admin/notification-scenarios/[id]
 * Получить сценарий по ID
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id } = params

    if (!checkPermission(user, 'notificationScenarios', 'read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const scenario = await scenarioService.getById(id)

    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
    }

    return NextResponse.json({ scenario })
  }
})

/**
 * PUT /api/admin/notification-scenarios/[id]
 * Обновить сценарий
 */
export const PUT = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    const { id } = params

    if (!checkPermission(user, 'notificationScenarios', 'update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json()) as Partial<NotificationScenarioConfig>
    const scenario = await scenarioService.update(id, body)

    return NextResponse.json({ scenario })
  }
})

/**
 * DELETE /api/admin/notification-scenarios/[id]
 * Удалить сценарий
 */
export const DELETE = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id } = params

    if (!checkPermission(user, 'notificationScenarios', 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await scenarioService.delete(id)

    return NextResponse.json({ success: true })
  }
})
