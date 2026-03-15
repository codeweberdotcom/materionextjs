/**
 * API: Media - список и загрузка
 * GET /api/admin/media - Получить список медиа
 * POST /api/admin/media - Загрузить медиа файл
 *
 * @module app/api/admin/media
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import type { MediaEntityType } from '@/services/media';
import { getMediaService } from '@/services/media'
import logger from '@/lib/logger'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

/**
 * GET /api/admin/media
 * Получить список медиа файлов с фильтрацией
 */
export const GET = withApiHandler({
  handler: async ({ user, request }) => {
    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
  }
})

/**
 * POST /api/admin/media
 * Загрузить медиа файл
 */
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const entityType = formData.get('entityType') as string
    const entityId = formData.get('entityId') as string | null
    const alt = formData.get('alt') as string | null
    const title = formData.get('title') as string | null
    const position = formData.get('position') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!entityType) {
      return NextResponse.json({ error: 'entityType is required' }, { status: 400 })
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
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    logger.info('[API] Media uploaded', {
      mediaId: result.media?.id,
      entityType,
      uploadedBy: user.id,
    })

    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'media',
      module: 'media',
      type: 'media.file_uploaded',
      severity: 'info',
      message: `Media file uploaded: ${file.name}`,
      actor: { type: 'user', id: user.id },
      subject: { type: 'media', id: result.media?.id },
      payload: { filename: file.name, entityType, entityId, mediaId: result.media?.id }
    }))

    return NextResponse.json({
      success: true,
      media: result.media,
    })
  }
})
