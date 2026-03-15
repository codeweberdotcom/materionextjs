/**
 * API для управления конкретной конфигурацией сервиса
 *
 * GET    /api/admin/settings/services/[id] - Получить конфигурацию
 * PUT    /api/admin/settings/services/[id] - Обновить конфигурацию
 * DELETE /api/admin/settings/services/[id] - Удалить конфигурацию
 *
 * @module app/api/admin/settings/services/[id]
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isSuperadmin, isAdminByCode } from '@/utils/permissions/permissions'
import { serviceConfigurationService } from '@/modules/settings/services'
import { updateServiceConfigurationSchema } from '@/lib/config/validators'
import { eventService } from '@/services/events/EventService'
import logger from '@/lib/logger'

/**
 * GET /api/admin/settings/services/[id]
 * Получить конфигурацию сервиса по ID
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id } = params

    if (!isSuperadmin(user) && !isAdminByCode(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const service = await serviceConfigurationService.getById(id)

    if (!service) {
      return NextResponse.json(
        { error: 'Конфигурация не найдена' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: service
    })
  }
})

/**
 * PUT /api/admin/settings/services/[id]
 * Обновить конфигурацию сервиса
 */
export const PUT = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    const { id } = params

    if (!isSuperadmin(user) && !isAdminByCode(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Парсим и валидируем тело запроса
    const body = await request.json()
    const validationResult = updateServiceConfigurationSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Ошибка валидации',
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    try {
      // Обновляем конфигурацию
      const service = await serviceConfigurationService.update(
        id,
        validationResult.data as any,
        user.id
      )

      // Логируем событие
      await eventService.record({
        source: 'api',
        module: 'settings',
        type: 'service_configuration.updated',
        severity: 'info',
        actor: {
          type: 'user',
          id: user.id
        },
        subject: {
          type: 'service_configuration',
          id: service.id
        },
        message: `Обновлена конфигурация сервиса: ${service.displayName}`,
        payload: {
          name: service.name,
          type: service.type,
          changes: Object.keys(validationResult.data)
        }
      })

      logger.info('[API:Services] Updated service configuration', {
        userId: user.id,
        serviceId: service.id,
        serviceName: service.name
      })

      return NextResponse.json({
        success: true,
        data: service
      })
    } catch (error) {
      logger.error('[API:Services] Failed to update service', {
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
})

/**
 * DELETE /api/admin/settings/services/[id]
 * Удалить конфигурацию сервиса
 */
export const DELETE = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id } = params

    if (!isSuperadmin(user) && !isAdminByCode(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Получаем информацию о сервисе перед удалением
    const service = await serviceConfigurationService.getById(id)

    if (!service) {
      return NextResponse.json(
        { error: 'Конфигурация не найдена' },
        { status: 404 }
      )
    }

    // Удаляем конфигурацию
    await serviceConfigurationService.delete(id, user.id)

    // Логируем событие
    await eventService.record({
      source: 'api',
      module: 'settings',
      type: 'service_configuration.deleted',
      severity: 'warning',
      actor: {
        type: 'user',
        id: user.id
      },
      subject: {
        type: 'service_configuration',
        id: id
      },
      message: `Удалена конфигурация сервиса: ${service.displayName}`,
      payload: {
        name: service.name,
        type: service.type
      }
    })

    logger.info('[API:Services] Deleted service configuration', {
      userId: user.id,
      serviceId: id,
      serviceName: service.name
    })

    return NextResponse.json({
      success: true,
      message: 'Конфигурация удалена'
    })
  }
})
