/**
 * API для управления конфигурациями внешних сервисов
 *
 * GET  /api/admin/settings/services - Получить список сервисов
 * POST /api/admin/settings/services - Создать новую конфигурацию
 *
 * @module app/api/admin/settings/services
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isSuperadmin, isAdminByCode } from '@/utils/permissions/permissions'
import { serviceConfigurationService } from '@/modules/settings/services'
import { createServiceConfigurationSchema, listServicesQuerySchema } from '@/lib/config/validators'
import { eventService } from '@/services/events/EventService'
import logger from '@/lib/logger'

/**
 * GET /api/admin/settings/services
 * Получить список всех конфигураций сервисов (без credentials)
 */
export const GET = withApiHandler({
  handler: async ({ user, request }) => {
    if (!isSuperadmin(user) && !isAdminByCode(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Парсим query параметры
    const searchParams = request.nextUrl.searchParams

    const queryResult = listServicesQuerySchema.safeParse({
      type: searchParams.get('type') || undefined,
      enabled: searchParams.get('enabled') || undefined,
      status: searchParams.get('status') || undefined
    })

    const filters = queryResult.success ? queryResult.data : undefined

    // Получаем список сервисов
    const services = await serviceConfigurationService.getAll(filters as any)

    logger.info('[API:Services] Listed service configurations', {
      userId: user.id,
      count: services.length,
      filters
    })

    return NextResponse.json({
      success: true,
      data: services,
      count: services.length
    })
  }
})

/**
 * POST /api/admin/settings/services
 * Создать новую конфигурацию сервиса
 */
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    if (!isSuperadmin(user) && !isAdminByCode(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Парсим и валидируем тело запроса
    const body = await request.json()
    const validationResult = createServiceConfigurationSchema.safeParse(body)

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
      // Создаем конфигурацию
      const service = await serviceConfigurationService.create(
        validationResult.data as any,
        user.id
      )

      // Логируем событие
      await eventService.record({
        source: 'api',
        module: 'settings',
        type: 'service_configuration.created',
        severity: 'info',
        actor: {
          type: 'user',
          id: user.id
        },
        subject: {
          type: 'service_configuration',
          id: service.id
        },
        message: `Создана конфигурация сервиса: ${service.displayName}`,
        payload: {
          name: service.name,
          type: service.type,
          host: service.host
        }
      })

      logger.info('[API:Services] Created service configuration', {
        userId: user.id,
        serviceId: service.id,
        serviceName: service.name
      })

      return NextResponse.json(
        {
          success: true,
          data: service
        },
        { status: 201 }
      )
    } catch (error) {
      logger.error('[API:Services] Failed to create service', {
        error: error instanceof Error ? error.message : String(error)
      })

      // Проверяем на уникальность имени
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'Сервис с таким именем уже существует' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Внутренняя ошибка сервера' },
        { status: 500 }
      )
    }
  }
})
