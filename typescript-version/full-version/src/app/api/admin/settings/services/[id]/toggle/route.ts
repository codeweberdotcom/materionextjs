/**
 * API для переключения статуса enabled у сервиса
 *
 * POST /api/admin/settings/services/[id]/toggle - Переключить enabled
 *
 * @module app/api/admin/settings/services/[id]/toggle
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isSuperadmin, isAdminByCode } from '@/utils/permissions/permissions'
import { serviceConfigurationService } from '@/modules/settings/services'
import { eventService } from '@/services/events/EventService'
import logger from '@/lib/logger'

/**
 * POST /api/admin/settings/services/[id]/toggle
 * Переключить enabled статус сервиса
 */
export const POST = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id } = params

    if (!isSuperadmin(user) && !isAdminByCode(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Переключаем статус
    const service = await serviceConfigurationService.toggleEnabled(id, user.id)

    // Логируем событие
    await eventService.record({
      source: 'api',
      module: 'settings',
      type: service.enabled ? 'service_configuration.enabled' : 'service_configuration.disabled',
      severity: 'info',
      actor: {
        type: 'user',
        id: user.id
      },
      subject: {
        type: 'service_configuration',
        id: id
      },
      message: service.enabled
        ? `Сервис включен: ${service.displayName}`
        : `Сервис отключен: ${service.displayName}`,
      payload: {
        name: service.name,
        type: service.type,
        enabled: service.enabled
      }
    })

    logger.info('[API:Services] Toggled service enabled status', {
      userId: user.id,
      serviceId: id,
      serviceName: service.name,
      enabled: service.enabled
    })

    return NextResponse.json({
      success: true,
      data: service
    })
  }
})
