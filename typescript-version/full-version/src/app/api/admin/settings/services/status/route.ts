/**
 * API для получения статуса всех сервисов
 *
 * GET /api/admin/settings/services/status - Получить статус всех сервисов
 *
 * @module app/api/admin/settings/services/status
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isSuperadmin, isAdminByCode } from '@/utils/permissions/permissions'
import { serviceConfigResolver } from '@/lib/config'
import logger from '@/lib/logger'

/**
 * GET /api/admin/settings/services/status
 * Получить статус всех сервисов (источник конфигурации)
 */
export const GET = withApiHandler({
  handler: async ({ user }) => {
    if (!isSuperadmin(user) && !isAdminByCode(user)) {
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
  }
})
