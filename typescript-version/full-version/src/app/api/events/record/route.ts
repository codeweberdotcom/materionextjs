import { NextRequest, NextResponse } from 'next/server'
import { eventService } from '@/services/events'
import { requireAuth } from '@/utils/auth/auth'
import logger from '@/lib/logger'
import type { RecordEventInput } from '@/services/events/EventService'

/**
 * POST /api/events/record
 * Записывает событие в базу данных
 * Используется для записи событий из клиентского кода
 */
export async function POST(request: NextRequest) {
  try {
    // Получаем пользователя (необязательно, так как события могут быть системными)
    const { user } = await requireAuth(request).catch(() => ({ user: null }))

    let body: RecordEventInput
    try {
      body = await request.json()
    } catch (error) {
      logger.warn('[events/record] Invalid JSON in request body', {
        error: error instanceof Error ? error.message : error
      })
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Если actorId не указан, но есть пользователь, используем его ID
    if (!body.actor?.id && user?.id) {
      body.actor = {
        type: 'user',
        id: user.id,
        ...body.actor
      }
    }

    // Определяем environment из заголовка x-test-request
    const isTestRequest = request.headers.get('x-test-request') === 'true'
    const testRunId = request.headers.get('x-test-run-id') || undefined
    const testSuite = request.headers.get('x-test-suite') || undefined

    // Добавляем контекст для различения тестовых и реальных событий
    const eventInput = {
      ...body,
      environment: isTestRequest ? 'test' : (body.environment || 'production'),
      ...(testRunId && { testRunId }),
      ...(testSuite && { testSuite })
    }

    // Записываем событие
    const event = await eventService.record(eventInput)

    if (!event) {
      logger.warn('[events/record] Failed to record event', {
        source: body.source,
        type: body.type
      })
      return NextResponse.json(
        { error: 'Failed to record event' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      eventId: event.id
    })

  } catch (error) {
    logger.error('[events/record] API error', {
      error: error instanceof Error ? error.message : error,
      file: 'src/app/api/events/record/route.ts'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


