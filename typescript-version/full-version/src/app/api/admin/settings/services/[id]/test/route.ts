/**
 * API для тестирования подключения к сервису
 *
 * POST /api/admin/settings/services/[id]/test - Тестировать подключение
 *
 * @module app/api/admin/settings/services/[id]/test
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isSuperadmin, isAdminByCode } from '@/utils/permissions/permissions'
import { serviceConfigurationService } from '@/modules/settings/services'
import { eventService } from '@/services/events/EventService'
import logger from '@/lib/logger'

/**
 * POST /api/admin/settings/services/[id]/test
 * Тестировать подключение к сервису
 */
export const POST = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id } = params

    if (!isSuperadmin(user) && !isAdminByCode(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
    await eventService.record({
      source: 'api',
      module: 'settings',
      type: result.success ? 'service_configuration.test_success' : 'service_configuration.test_failed',
      severity: result.success ? 'info' : 'warning',
      actor: {
        type: 'user',
        id: user.id
      },
      subject: {
        type: 'service_configuration',
        id: id
      },
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
  }
})
