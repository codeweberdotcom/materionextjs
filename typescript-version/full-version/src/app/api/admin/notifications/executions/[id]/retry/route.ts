import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import { scenarioEngine } from '@/services/notifications/scenarios'
import logger from '@/lib/logger'

/**
 * POST /api/admin/notifications/executions/[id]/retry
 * Повторить выполнение сценария
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(user, 'notificationScenarios', 'update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Получаем выполнение
    const execution = await prisma.notificationExecution.findUnique({
      where: { id },
      include: {
        scenario: true
      }
    })

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
    }

    if (execution.status !== 'failed') {
      return NextResponse.json(
        { error: 'Only failed executions can be retried' },
        { status: 400 }
      )
    }

    if (!execution.scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      )
    }

    // Создаём новое выполнение
    const newExecution = await prisma.notificationExecution.create({
      data: {
        scenarioId: execution.scenarioId,
        eventId: execution.eventId,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3
      }
    })

    // Парсим данные сценария
    let actions = []
    try {
      actions = JSON.parse(execution.scenario.actions)
    } catch {}

    // Запускаем выполнение асинхронно
    // В реальном приложении здесь была бы очередь
    setImmediate(async () => {
      try {
        await prisma.notificationExecution.update({
          where: { id: newExecution.id },
          data: { status: 'processing' }
        })

        // Выполняем действия
        const results = []
        for (const action of actions) {
          try {
            // Здесь должна быть логика выполнения действия
            // Для простоты просто логируем
            logger.info('[Retry] Executing action', { 
              executionId: newExecution.id,
              action 
            })
            results.push({ success: true, action })
          } catch (error) {
            results.push({ 
              success: false, 
              action, 
              error: error instanceof Error ? error.message : String(error) 
            })
          }
        }

        const allSuccessful = results.every(r => r.success)
        
        await prisma.notificationExecution.update({
          where: { id: newExecution.id },
          data: {
            status: allSuccessful ? 'completed' : 'failed',
            result: JSON.stringify({ actions: results }),
            error: allSuccessful ? null : 'Some actions failed',
            completedAt: new Date(),
            attempts: 1
          }
        })
      } catch (error) {
        await prisma.notificationExecution.update({
          where: { id: newExecution.id },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            completedAt: new Date(),
            attempts: 1
          }
        })
      }
    })

    logger.info('[API:NotificationExecution] Retry started', {
      originalId: id,
      newId: newExecution.id,
      userId: user.id
    })

    return NextResponse.json({
      success: true,
      execution: {
        id: newExecution.id,
        status: 'pending',
        originalId: id
      }
    })
  } catch (error) {
    logger.error('[API:NotificationExecution] Failed to retry', {
      error: error instanceof Error ? error.message : String(error),
      executionId: id
    })
    return NextResponse.json(
      { error: 'Failed to retry execution' },
      { status: 500 }
    )
  }
}

