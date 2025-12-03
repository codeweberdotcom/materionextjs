/**
 * API: Media Queue - статистика и управление очередями
 * GET /api/admin/media/queue - Получить статистику очередей
 * POST /api/admin/media/queue - Управление очередями (pause, resume, clean)
 * 
 * @module app/api/admin/media/queue
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { mediaProcessingQueue, mediaSyncQueue } from '@/services/media'
import logger from '@/lib/logger'

/**
 * GET /api/admin/media/queue
 * Получить статистику очередей
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    // Получаем статистику обеих очередей
    const [processingStats, syncStats] = await Promise.all([
      mediaProcessingQueue.getStats(),
      mediaSyncQueue.getStats(),
    ])

    return NextResponse.json({
      processing: {
        ...processingStats,
        queueAvailable: mediaProcessingQueue.isQueueAvailable(),
      },
      sync: {
        ...syncStats,
        queueAvailable: mediaSyncQueue.isQueueAvailable(),
      },
    })
  } catch (error) {
    logger.error('[API] GET /api/admin/media/queue failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to fetch queue stats' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/media/queue
 * Управление очередями
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, queue } = body

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      )
    }

    const targetQueue = queue === 'sync' ? mediaSyncQueue : mediaProcessingQueue
    const queueName = queue === 'sync' ? 'sync' : 'processing'

    switch (action) {
      case 'pause':
        await (targetQueue as any).pause?.()
        logger.info(`[API] Queue ${queueName} paused`, { by: user.id })
        return NextResponse.json({ success: true, message: `Queue ${queueName} paused` })

      case 'resume':
        await (targetQueue as any).resume?.()
        logger.info(`[API] Queue ${queueName} resumed`, { by: user.id })
        return NextResponse.json({ success: true, message: `Queue ${queueName} resumed` })

      case 'clean':
        await (targetQueue as any).clean?.()
        logger.info(`[API] Queue ${queueName} cleaned`, { by: user.id })
        return NextResponse.json({ success: true, message: `Queue ${queueName} cleaned` })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    logger.error('[API] POST /api/admin/media/queue failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to execute queue action' },
      { status: 500 }
    )
  }
}

