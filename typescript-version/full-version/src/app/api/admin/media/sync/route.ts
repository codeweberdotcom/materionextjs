/**
 * API: Media Sync - синхронизация между хранилищами
 * POST /api/admin/media/sync - Создать задачу синхронизации
 * GET /api/admin/media/sync - Получить список задач
 * 
 * @module app/api/admin/media/sync
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { getMediaSyncService, SyncScope, SyncOperation, initializeMediaQueues, getStorageService } from '@/services/media'
import logger from '@/lib/logger'

type SyncAction = 
  | 'upload_to_s3_with_delete'
  | 'upload_to_s3_keep_local'
  | 'download_from_s3'
  | 'download_from_s3_delete_s3'
  | 'delete_local_only'
  | 'delete_s3_only'
  | 'purge_s3'
  | 'verify_status'

/**
 * POST /api/admin/media/sync
 * Создать задачу синхронизации
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    // Только SUPERADMIN может синхронизировать
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, scope, entityType, mediaIds, overwrite } = body as {
      action: SyncAction
      scope: SyncScope
      entityType?: string
      mediaIds?: string[]
      overwrite?: boolean
    }

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      )
    }

    if (!scope) {
      return NextResponse.json(
        { error: 'scope is required' },
        { status: 400 }
      )
    }

    if (scope === 'selected' && (!mediaIds || mediaIds.length === 0)) {
      return NextResponse.json(
        { error: 'mediaIds is required for selected scope' },
        { status: 400 }
      )
    }

    if (scope === 'entity_type' && !entityType) {
      return NextResponse.json(
        { error: 'entityType is required for entity_type scope' },
        { status: 400 }
      )
    }

    // Инициализируем очереди и workers
    await initializeMediaQueues()

    // Проверяем S3 конфигурацию для операций с S3
    const s3RequiredActions = [
      'upload_to_s3_with_delete', 
      'upload_to_s3_keep_local',
      'download_from_s3',
      'download_from_s3_delete_s3',
      'delete_s3_only',
      'purge_s3',
    ]
    
    if (s3RequiredActions.includes(action)) {
      const storageService = await getStorageService()
      if (!storageService.isS3Available()) {
        return NextResponse.json(
          { error: 'S3 не настроен. Настройте S3 в настройках медиатеки или добавьте внешний S3 сервис.' },
          { status: 400 }
        )
      }
    }

    const syncService = getMediaSyncService()
    let job

    switch (action) {
      case 'upload_to_s3_with_delete':
        job = await syncService.uploadToS3WithDelete({
          scope,
          entityType,
          mediaIds,
          overwrite,
          createdBy: user.id,
        })
        break

      case 'upload_to_s3_keep_local':
        job = await syncService.uploadToS3KeepLocal({
          scope,
          entityType,
          mediaIds,
          overwrite,
          createdBy: user.id,
        })
        break

      case 'download_from_s3':
        job = await syncService.downloadFromS3({
          scope,
          entityType,
          mediaIds,
          deleteFromS3: false,
          createdBy: user.id,
        })
        break

      case 'download_from_s3_delete_s3':
        job = await syncService.downloadFromS3({
          scope,
          entityType,
          mediaIds,
          deleteFromS3: true,
          createdBy: user.id,
        })
        break

      case 'delete_local_only':
        job = await syncService.deleteLocalOnly({
          scope,
          entityType,
          mediaIds,
          createdBy: user.id,
        })
        break

      case 'delete_s3_only':
        job = await syncService.deleteS3Only({
          scope,
          entityType,
          mediaIds,
          createdBy: user.id,
        })
        break

      case 'purge_s3':
        // Очистка всего S3 bucket (независимо от БД)
        const purgeResult = await syncService.purgeS3Bucket({ createdBy: user.id })

        logger.warn('[API] S3 bucket purge completed', {
          jobId: purgeResult.job?.id,
          deletedFiles: purgeResult.deletedFiles,
          deletedBytes: purgeResult.deletedBytes,
          errors: purgeResult.errors,
          userId: user.id,
        })

        return NextResponse.json({
          success: true,
          job: purgeResult.job,
          purge: {
            deletedFiles: purgeResult.deletedFiles,
            deletedBytes: purgeResult.deletedBytes,
            errors: purgeResult.errors,
          },
        })

      case 'verify_status':
        // Верификация не создаёт job, выполняется синхронно
        const verifyResult = await syncService.verifyStorageStatus({
          scope,
          entityType,
          mediaIds,
        })

        logger.info('[API] Storage status verification completed', {
          total: verifyResult.total,
          updated: verifyResult.updated,
        })

        return NextResponse.json({
          success: true,
          verification: verifyResult,
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    logger.info('[API] Sync job created', {
      jobId: job.id,
      action,
      scope,
      createdBy: user.id,
    })

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        operation: job.operation,
        totalFiles: job.totalFiles,
      },
    })
  } catch (error) {
    logger.error('[API] POST /api/admin/media/sync failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create sync job' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/media/sync
 * Получить список задач синхронизации
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const operation = searchParams.get('operation') || undefined
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const syncService = getMediaSyncService()
    const result = await syncService.listJobs({
      status: status as any,
      operation: operation as SyncOperation,
      limit,
      offset,
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('[API] GET /api/admin/media/sync failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to fetch sync jobs' },
      { status: 500 }
    )
  }
}


