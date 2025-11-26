import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { scenarioService } from '@/services/notifications/scenarios'
import type { NotificationScenarioConfig } from '@/services/notifications/scenarios/types'
import logger from '@/lib/logger'

/**
 * GET /api/admin/notification-scenarios/[id]
 * Получить сценарий по ID
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

    // Проверка прав доступа
    if (!checkPermission(user, 'notificationScenarios', 'read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const scenario = await scenarioService.getById(id)
    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
    }

    return NextResponse.json({ scenario })
  } catch (error) {
    logger.error('[API:NotificationScenarios] Failed to get scenario', {
      error: error instanceof Error ? error.message : String(error),
      scenarioId: id
    })
    return NextResponse.json(
      { error: 'Failed to get scenario' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/notification-scenarios/[id]
 * Обновить сценарий
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверка прав доступа
    if (!checkPermission(user, 'notificationScenarios', 'update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json()) as Partial<NotificationScenarioConfig>
    const scenario = await scenarioService.update(id, body)

    return NextResponse.json({ scenario })
  } catch (error) {
    logger.error('[API:NotificationScenarios] Failed to update scenario', {
      error: error instanceof Error ? error.message : String(error),
      scenarioId: id
    })
    return NextResponse.json(
      { error: 'Failed to update scenario' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/notification-scenarios/[id]
 * Удалить сценарий
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверка прав доступа
    if (!checkPermission(user, 'notificationScenarios', 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await scenarioService.delete(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[API:NotificationScenarios] Failed to delete scenario', {
      error: error instanceof Error ? error.message : String(error),
      scenarioId: id
    })
    return NextResponse.json(
      { error: 'Failed to delete scenario' },
      { status: 500 }
    )
  }
}



