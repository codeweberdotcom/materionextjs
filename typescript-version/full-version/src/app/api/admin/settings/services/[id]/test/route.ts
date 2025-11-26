/**
 * API для тестирования подключения к сервису
 * 
 * POST /api/admin/settings/services/[id]/test - Тестировать подключение
 * 
 * @module app/api/admin/settings/services/[id]/test
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { serviceConfigurationService } from '@/modules/settings/services'
import { eventService } from '@/services/events/EventService'
import logger from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/settings/services/[id]/test
 * Тестировать подключение к сервису
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Проверяем авторизацию
    const { user } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем права доступа
    const userRole = user.role?.name?.toUpperCase()
    if (!['SUPERADMIN', 'ADMIN'].includes(userRole || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Получаем информацию о сервисе
    const service = await serviceConfigurationService.getById(id)

    if (!service) {
      return NextResponse.json(
        { error: 'Конфигурация не найдена' },
        { status: 404 }
      )
    }

    // Тестируем подключение
    const result = await serviceConfigurationService.testConnection(id)

    // Логируем событие
    await eventService.emit({
      source: 'api',
      module: 'settings',
      type: result.success ? 'service_configuration.test_success' : 'service_configuration.test_failed',
      severity: result.success ? 'info' : 'warning',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'service_configuration',
      subjectId: id,
      message: result.success
        ? `Тест подключения успешен: ${service.displayName}`
        : `Тест подключения не удался: ${service.displayName}`,
      payload: {
        name: service.name,
        type: service.type,
        success: result.success,
        latency: result.latency,
        version: result.version,
        error: result.error
      }
    })

    logger.info('[API:Services] Connection test completed', {
      userId: user.id,
      serviceId: id,
      serviceName: service.name,
      success: result.success,
      latency: result.latency
    })

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        serviceName: service.name,
        serviceType: service.type
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    logger.error('[API:Services] Failed to test connection', {
      id,
      error: error instanceof Error ? error.message : String(error)
    })

    if (error instanceof Error && error.message === 'Конфигурация не найдена') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
