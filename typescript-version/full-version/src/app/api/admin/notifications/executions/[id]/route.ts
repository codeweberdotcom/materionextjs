import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { checkPermission } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'

/**
 * GET /api/admin/notifications/executions/[id]
 * Получить детали выполнения
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id } = params

    if (!checkPermission(user, 'notificationScenarios', 'read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const execution = await prisma.notificationExecution.findUnique({
      where: { id },
      include: {
        scenario: {
          select: {
            id: true,
            name: true,
            description: true,
            trigger: true,
            actions: true
          }
        }
      }
    })

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
    }

    // Парсим JSON поля
    let result = null
    let trigger = null
    let actions = null

    try {
      result = execution.result ? JSON.parse(execution.result) : null
    } catch {}

    try {
      trigger = execution.scenario?.trigger ? JSON.parse(execution.scenario.trigger) : null
    } catch {}

    try {
      actions = execution.scenario?.actions ? JSON.parse(execution.scenario.actions) : null
    } catch {}

    return NextResponse.json({
      execution: {
        id: execution.id,
        scenarioId: execution.scenarioId,
        scenario: {
          id: execution.scenario?.id,
          name: execution.scenario?.name,
          description: execution.scenario?.description,
          trigger,
          actions
        },
        eventId: execution.eventId,
        status: execution.status,
        result,
        error: execution.error,
        attempts: execution.attempts,
        maxAttempts: execution.maxAttempts,
        createdAt: execution.createdAt,
        completedAt: execution.completedAt,
        scheduledAt: execution.scheduledAt
      }
    })
  }
})
