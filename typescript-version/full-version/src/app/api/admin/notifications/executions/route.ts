import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

/**
 * GET /api/admin/notifications/executions
 * Получить список выполнений сценариев с пагинацией и фильтрами
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(user, 'notificationScenarios', 'read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const status = searchParams.get('status')
    const scenarioId = searchParams.get('scenarioId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Формируем условия фильтрации
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (scenarioId) {
      where.scenarioId = scenarioId
    }

    if (from || to) {
      where.createdAt = {}
      if (from) {
        where.createdAt.gte = new Date(from)
      }
      if (to) {
        where.createdAt.lte = new Date(to)
      }
    }

    // Получаем данные
    const [executions, total] = await Promise.all([
      prisma.notificationExecution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          scenario: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.notificationExecution.count({ where })
    ])

    // Парсим результаты для получения канала
    const items = executions.map(exec => {
      let channel = null
      let messageId = null
      try {
        const result = exec.result ? JSON.parse(exec.result) : null
        channel = result?.channel || null
        messageId = result?.messageId || null
      } catch {}

      return {
        id: exec.id,
        scenarioId: exec.scenarioId,
        scenarioName: exec.scenario?.name || 'Неизвестный',
        eventId: exec.eventId,
        status: exec.status,
        channel,
        messageId,
        error: exec.error,
        attempts: exec.attempts,
        maxAttempts: exec.maxAttempts,
        createdAt: exec.createdAt,
        completedAt: exec.completedAt,
        scheduledAt: exec.scheduledAt
      }
    })

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('[API:NotificationExecutions] Failed to get executions', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json(
      { error: 'Failed to get executions' },
      { status: 500 }
    )
  }
}

