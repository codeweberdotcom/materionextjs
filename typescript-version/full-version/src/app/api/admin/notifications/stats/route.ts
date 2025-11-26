import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

/**
 * GET /api/admin/notifications/stats
 * Получить статистику уведомлений за период
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
    const days = parseInt(searchParams.get('days') || '7', 10)
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)

    // Получаем статистику выполнений
    const [
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      pendingExecutions,
      recentExecutions,
      executionsByDay,
      topScenarios
    ] = await Promise.all([
      // Всего выполнений
      prisma.notificationExecution.count({
        where: { createdAt: { gte: fromDate } }
      }),

      // Успешных
      prisma.notificationExecution.count({
        where: {
          createdAt: { gte: fromDate },
          status: 'completed'
        }
      }),

      // С ошибками
      prisma.notificationExecution.count({
        where: {
          createdAt: { gte: fromDate },
          status: 'failed'
        }
      }),

      // В ожидании
      prisma.notificationExecution.count({
        where: {
          status: { in: ['pending', 'processing'] }
        }
      }),

      // Последние 10 выполнений
      prisma.notificationExecution.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          scenario: {
            select: { name: true }
          }
        }
      }),

      // Выполнения по дням (группировка)
      prisma.$queryRaw`
        SELECT
          DATE(createdAt) as date,
          status,
          COUNT(*) as count
        FROM NotificationExecution
        WHERE createdAt >= ${fromDate}
        GROUP BY DATE(createdAt), status
        ORDER BY date ASC
      `,

      // Топ сценариев
      prisma.notificationExecution.groupBy({
        by: ['scenarioId'],
        where: { createdAt: { gte: fromDate } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      })
    ])

    // Получаем имена сценариев для топа
    const scenarioIds = topScenarios.map(s => s.scenarioId)
    const scenarios = await prisma.notificationScenario.findMany({
      where: { id: { in: scenarioIds } },
      select: { id: true, name: true }
    })
    const scenarioMap = new Map(scenarios.map(s => [s.id, s.name]))

    const topScenariosWithNames = topScenarios.map(s => ({
      scenarioId: s.scenarioId,
      name: scenarioMap.get(s.scenarioId) || 'Неизвестный',
      count: s._count.id
    }))

    // Считаем статистику по каналам из результатов
    const channelStats: Record<string, number> = {}
    for (const exec of recentExecutions) {
      try {
        const result = exec.result ? JSON.parse(exec.result) : null
        if (result?.channel) {
          channelStats[result.channel] = (channelStats[result.channel] || 0) + 1
        }
      } catch {}
    }

    return NextResponse.json({
      period: { days, from: fromDate.toISOString() },
      summary: {
        total: totalExecutions,
        successful: successfulExecutions,
        failed: failedExecutions,
        pending: pendingExecutions,
        successRate: totalExecutions > 0
          ? Math.round((successfulExecutions / totalExecutions) * 100)
          : 0
      },
      recentExecutions: recentExecutions.map(e => ({
        id: e.id,
        scenarioId: e.scenarioId,
        scenarioName: (e as any).scenario?.name || 'Неизвестный',
        status: e.status,
        error: e.error,
        createdAt: e.createdAt,
        completedAt: e.completedAt
      })),
      executionsByDay,
      topScenarios: topScenariosWithNames,
      channelStats
    })
  } catch (error) {
    logger.error('[API:NotificationStats] Failed to get stats', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    )
  }
}

