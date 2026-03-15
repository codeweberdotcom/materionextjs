/**
 * API: Sync Job по ID
 * GET /api/admin/media/sync/[jobId] - Получить статус задачи
 * DELETE /api/admin/media/sync/[jobId] - Отменить задачу
 *
 * @module app/api/admin/media/sync/[jobId]
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { getMediaSyncService } from '@/services/media'
import logger from '@/lib/logger'

/**
 * GET /api/admin/media/sync/[jobId]
 * Получить статус задачи синхронизации
 */
export const GET = withApiHandler<unknown, { jobId: string }>({
  handler: async ({ user, request, params }) => {
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const { jobId } = params
    const { searchParams } = new URL(request.url)
    const detailed = searchParams.get('detailed') === 'true'

    const syncService = getMediaSyncService()

    if (detailed) {
      const result = await syncService.getJobResults(jobId)

      if (!result) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      return NextResponse.json(result)
    }

    const progress = await syncService.getJobStatus(jobId)

    if (!progress) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json(progress)
  }
})

/**
 * DELETE /api/admin/media/sync/[jobId]
 * Отменить задачу синхронизации
 */
export const DELETE = withApiHandler<unknown, { jobId: string }>({
  handler: async ({ user, params }) => {
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const { jobId } = params
    const syncService = getMediaSyncService()

    await syncService.cancelJob(jobId)

    logger.info('[API] Sync job cancelled', {
      jobId,
      cancelledBy: user.id,
    })

    return NextResponse.json({
      success: true,
      message: 'Job cancelled',
    })
  }
})
