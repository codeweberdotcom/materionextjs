/**
 * API для управления конкретной конфигурацией сервиса
 * 
 * GET    /api/admin/settings/services/[id] - Получить конфигурацию
 * PUT    /api/admin/settings/services/[id] - Обновить конфигурацию
 * DELETE /api/admin/settings/services/[id] - Удалить конфигурацию
 * 
 * @module app/api/admin/settings/services/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { serviceConfigurationService } from '@/modules/settings/services'
import { updateServiceConfigurationSchema } from '@/lib/config/validators'
import { eventService } from '@/services/events/EventService'
import logger from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/settings/services/[id]
 * Получить конфигурацию сервиса по ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Проверяем авторизацию
    const { user } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем права доступа
    const userRole = user.role?.code?.toUpperCase()
    if (!['SUPERADMIN', 'ADMIN'].includes(userRole || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Получаем конфигурацию
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
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    logger.error('[API:Services] Failed to get service', {
      id,
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/settings/services/[id]
 * Обновить конфигурацию сервиса
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Проверяем авторизацию
    const { user } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем права доступа
    const userRole = user.role?.code?.toUpperCase()
    if (!['SUPERADMIN', 'ADMIN'].includes(userRole || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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

/**
 * DELETE /api/admin/settings/services/[id]
 * Удалить конфигурацию сервиса
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Проверяем авторизацию
    const { user } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверяем права доступа
    const userRole = user.role?.code?.toUpperCase()
    if (!['SUPERADMIN', 'ADMIN'].includes(userRole || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

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
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    logger.error('[API:Services] Failed to delete service', {
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
