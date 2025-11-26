import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

/**
 * GET /api/admin/notifications/executions/[id]
 * Получить детали выполнения
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
  } catch (error) {
    logger.error('[API:NotificationExecution] Failed to get execution', {
      error: error instanceof Error ? error.message : String(error),
      executionId: id
    })
    return NextResponse.json(
      { error: 'Failed to get execution' },
      { status: 500 }
    )
  }
}

