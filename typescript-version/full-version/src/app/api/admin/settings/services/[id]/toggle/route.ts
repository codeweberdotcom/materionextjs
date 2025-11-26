/**
 * API для переключения статуса enabled у сервиса
 * 
 * POST /api/admin/settings/services/[id]/toggle - Переключить enabled
 * 
 * @module app/api/admin/settings/services/[id]/toggle
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
 * POST /api/admin/settings/services/[id]/toggle
 * Переключить enabled статус сервиса
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

    // Переключаем статус
    const service = await serviceConfigurationService.toggleEnabled(id, user.id)

    // Логируем событие
    await eventService.emit({
      source: 'api',
      module: 'settings',
      type: service.enabled ? 'service_configuration.enabled' : 'service_configuration.disabled',
      severity: 'info',
      actorType: 'user',
      actorId: user.id,
      subjectType: 'service_configuration',
      subjectId: id,
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
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    logger.error('[API:Services] Failed to toggle service', {
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
