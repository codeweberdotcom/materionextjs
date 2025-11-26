/**
 * API для управления конфигурациями внешних сервисов
 * 
 * GET  /api/admin/settings/services - Получить список сервисов
 * POST /api/admin/settings/services - Создать новую конфигурацию
 * 
 * @module app/api/admin/settings/services
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { serviceConfigurationService } from '@/modules/settings/services'
import { createServiceConfigurationSchema, listServicesQuerySchema } from '@/lib/config/validators'
import { eventService } from '@/services/events/EventService'
import logger from '@/lib/logger'

/**
 * GET /api/admin/settings/services
 * Получить список всех конфигураций сервисов (без credentials)
 */
export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const { user } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем права доступа (только admin/superadmin)
    const userRole = user.role?.name?.toUpperCase()
    if (!['SUPERADMIN', 'ADMIN'].includes(userRole || '')) {
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
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.error('[API:Services] Failed to list services', {
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/settings/services
 * Создать новую конфигурацию сервиса
 */
export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const { user } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем права доступа (только admin/superadmin)
    const userRole = user.role?.name?.toUpperCase()
    if (!['SUPERADMIN', 'ADMIN'].includes(userRole || '')) {
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

    // Создаем конфигурацию
    const service = await serviceConfigurationService.create(
      validationResult.data as any,
      user.id
    )

    // Логируем событие
    await eventService.emit({
      source: 'api',
      module: 'settings',
      type: 'service_configuration.created',
      severity: 'info',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'service_configuration',
      subjectId: service.id,
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
