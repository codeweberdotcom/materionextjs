/**
 * API: Sync Job по ID
 * GET /api/admin/media/sync/[jobId] - Получить статус задачи
 * DELETE /api/admin/media/sync/[jobId] - Отменить задачу
 * 
 * @module app/api/admin/media/sync/[jobId]
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { getMediaSyncService } from '@/services/media'
import logger from '@/lib/logger'

/**
 * GET /api/admin/media/sync/[jobId]
 * Получить статус задачи синхронизации
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const { jobId } = await params
    const { searchParams } = new URL(request.url)
    const detailed = searchParams.get('detailed') === 'true'

    const syncService = getMediaSyncService()

    if (detailed) {
      const result = await syncService.getJobResults(jobId)
      if (!result) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(result)
    }

    const progress = await syncService.getJobStatus(jobId)
    if (!progress) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(progress)
  } catch (error) {
    logger.error('[API] GET /api/admin/media/sync/[jobId] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/media/sync/[jobId]
 * Отменить задачу синхронизации
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const { jobId } = await params
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
  } catch (error) {
    logger.error('[API] DELETE /api/admin/media/sync/[jobId] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel job' },
      { status: 500 }
    )
  }
}

