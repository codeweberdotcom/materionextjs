/**
 * API для получения статуса всех сервисов
 * 
 * GET /api/admin/settings/services/status - Получить статус всех сервисов
 * 
 * @module app/api/admin/settings/services/status
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { serviceConfigResolver } from '@/lib/config'
import logger from '@/lib/logger'

/**
 * GET /api/admin/settings/services/status
 * Получить статус всех сервисов (источник конфигурации)
 */
export async function GET(request: NextRequest) {
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

    // Получаем статус всех сервисов
    const status = await serviceConfigResolver.getAllServicesStatus()

    logger.debug('[API:Services] Retrieved all services status', {
      userId: user.id
    })

    return NextResponse.json({
      success: true,
      data: status
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.error('[API:Services] Failed to get services status', {
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
