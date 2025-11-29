/**
 * API: Media - список и загрузка
 * GET /api/admin/media - Получить список медиа
 * POST /api/admin/media - Загрузить медиа файл
 * 
 * @module app/api/admin/media
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import { getMediaService, MediaEntityType } from '@/services/media'
import logger from '@/lib/logger'

/**
 * GET /api/admin/media
 * Получить список медиа файлов с фильтрацией
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!isAdminOrHigher(user)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Handle deleted filter: 'true' = only deleted, 'false' = only non-deleted, undefined = all
    const deletedParam = searchParams.get('deleted')
    let deletedFilter: boolean | undefined = undefined
    if (deletedParam === 'true') {
      deletedFilter = true  // Only deleted items (trash)
    } else if (deletedParam === 'false') {
      deletedFilter = false  // Only non-deleted items (files)
    }
    
    const options = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sortBy: (searchParams.get('sortBy') || 'createdAt') as 'createdAt' | 'filename' | 'size' | 'entityType',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
      entityType: searchParams.get('entityType') as MediaEntityType | undefined,
      entityId: searchParams.get('entityId') || undefined,
      storageStatus: searchParams.get('storageStatus') || undefined,
      isProcessed: searchParams.get('isProcessed') === 'true' ? true : 
                   searchParams.get('isProcessed') === 'false' ? false : undefined,
      hasWatermark: searchParams.get('hasWatermark') === 'true' ? true :
                    searchParams.get('hasWatermark') === 'false' ? false : undefined,
      search: searchParams.get('search') || undefined,
      deleted: deletedFilter,
      includeDeleted: searchParams.get('includeDeleted') === 'true',
    }

    const mediaService = getMediaService()
    const result = await mediaService.list(options as any)

    return NextResponse.json(result)
  } catch (error) {
    logger.error('[API] GET /api/admin/media failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/media
 * Загрузить медиа файл
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!isAdminOrHigher(user)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const entityType = formData.get('entityType') as string
    const entityId = formData.get('entityId') as string | null
    const alt = formData.get('alt') as string | null
    const title = formData.get('title') as string | null
    const position = formData.get('position') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!entityType) {
      return NextResponse.json(
        { error: 'entityType is required' },
        { status: 400 }
      )
    }

    const mediaService = getMediaService()
    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await mediaService.upload(buffer, file.name, file.type, {
      entityType: entityType as MediaEntityType,
      entityId: entityId || undefined,
      uploadedBy: user.id,
      alt: alt || undefined,
      title: title || undefined,
      position: position ? parseInt(position) : undefined,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    logger.info('[API] Media uploaded', {
      mediaId: result.media?.id,
      entityType,
      uploadedBy: user.id,
    })

    return NextResponse.json({
      success: true,
      media: result.media,
    })
  } catch (error) {
    logger.error('[API] POST /api/admin/media failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to upload media' },
      { status: 500 }
    )
  }
}


