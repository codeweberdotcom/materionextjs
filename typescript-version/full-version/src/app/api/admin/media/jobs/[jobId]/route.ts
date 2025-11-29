/**
 * API: Media Job Status - статус задачи обработки
 * GET /api/admin/media/jobs/[jobId] - Получить статус задачи
 * 
 * @module app/api/admin/media/jobs/[jobId]
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import { mediaProcessingQueue, mediaSyncQueue } from '@/services/media'
import logger from '@/lib/logger'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

/**
 * GET /api/admin/media/jobs/[jobId]
 * Получить статус задачи
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(request)

    if (!isAdminOrHigher(user)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { jobId } = await params

    // Определяем тип очереди по префиксу
    const isSyncJob = jobId.startsWith('inmem_sync_') || jobId.includes('sync')
    const queue = isSyncJob ? mediaSyncQueue : mediaProcessingQueue

    // Получаем задачу
    const job = await queue.getJob(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Формируем ответ в зависимости от типа задачи
    if ('type' in job && job.type === 'in-memory') {
      // In-memory job
      const inMemoryJob = job as any
      return NextResponse.json({
        jobId: inMemoryJob.id,
        status: inMemoryJob.status,
        progress: inMemoryJob.progress || 0,
        data: inMemoryJob.data,
        error: inMemoryJob.error,
        queueType: 'in-memory',
      })
    }

    // Bull job
    const bullJob = job as any
    const state = await bullJob.getState?.()
    const progress = bullJob.progress?.() || bullJob._progress || 0

    return NextResponse.json({
      jobId: bullJob.id,
      status: state || 'unknown',
      progress,
      data: bullJob.data,
      result: bullJob.returnvalue,
      failedReason: bullJob.failedReason,
      attemptsMade: bullJob.attemptsMade,
      queueType: 'bull',
    })
  } catch (error) {
    logger.error('[API] GET /api/admin/media/jobs/[jobId] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    )
  }
}

