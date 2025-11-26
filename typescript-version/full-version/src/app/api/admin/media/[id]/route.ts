/**
 * API: Media по ID
 * GET /api/admin/media/[id] - Получить медиа
 * PUT /api/admin/media/[id] - Обновить медиа
 * DELETE /api/admin/media/[id] - Удалить медиа
 * 
 * @module app/api/admin/media/[id]
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import { getMediaService } from '@/services/media'
import logger from '@/lib/logger'

/**
 * GET /api/admin/media/[id]
 * Получить медиа по ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!isAdminOrHigher(user)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { id } = await params
    const mediaService = getMediaService()
    const media = await mediaService.getById(id)

    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }

    // Получаем URL для всех вариантов
    const variants = JSON.parse(media.variants || '{}')
    const urls: Record<string, string> = {}

    for (const [name] of Object.entries(variants)) {
      try {
        urls[name] = await mediaService.getUrl(id, name)
      } catch {
        // Игнорируем ошибки получения URL
      }
    }

    // URL оригинала
    try {
      urls.original = await mediaService.getUrl(id)
    } catch {
      // Игнорируем
    }

    return NextResponse.json({
      media,
      urls,
    })
  } catch (error) {
    logger.error('[API] GET /api/admin/media/[id] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/media/[id]
 * Обновить медиа
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!isAdminOrHigher(user)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    const mediaService = getMediaService()
    const media = await mediaService.getById(id)

    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }

    const updated = await mediaService.update(id, {
      alt: body.alt,
      title: body.title,
      caption: body.caption,
      description: body.description,
      position: body.position,
      entityId: body.entityId,
    })

    logger.info('[API] Media updated', {
      mediaId: id,
      updatedBy: user.id,
    })

    return NextResponse.json({
      success: true,
      media: updated,
    })
  } catch (error) {
    logger.error('[API] PUT /api/admin/media/[id] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to update media' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/media/[id]
 * Удалить медиа
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!isAdminOrHigher(user)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const hard = searchParams.get('hard') === 'true'

    const mediaService = getMediaService()
    const media = await mediaService.getById(id)

    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }

    await mediaService.delete(id, hard)

    logger.info('[API] Media deleted', {
      mediaId: id,
      hard,
      deletedBy: user.id,
    })

    return NextResponse.json({
      success: true,
      message: hard ? 'Media permanently deleted' : 'Media soft deleted',
    })
  } catch (error) {
    logger.error('[API] DELETE /api/admin/media/[id] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to delete media' },
      { status: 500 }
    )
  }
}


