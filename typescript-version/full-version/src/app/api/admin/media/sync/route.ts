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
import { getMediaSyncService, SyncScope, SyncOperation } from '@/services/media'
import logger from '@/lib/logger'

type SyncAction = 
  | 'upload_to_s3_with_delete'
  | 'upload_to_s3_keep_local'
  | 'download_from_s3'
  | 'download_from_s3_delete_s3'
  | 'delete_local_only'
  | 'delete_s3_only'

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
    const { action, scope, entityType, mediaIds } = body as {
      action: SyncAction
      scope: SyncScope
      entityType?: string
      mediaIds?: string[]
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

    const syncService = getMediaSyncService()
    let job

    switch (action) {
      case 'upload_to_s3_with_delete':
        job = await syncService.uploadToS3WithDelete({
          scope,
          entityType,
          mediaIds,
          createdBy: user.id,
        })
        break

      case 'upload_to_s3_keep_local':
        job = await syncService.uploadToS3KeepLocal({
          scope,
          entityType,
          mediaIds,
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

