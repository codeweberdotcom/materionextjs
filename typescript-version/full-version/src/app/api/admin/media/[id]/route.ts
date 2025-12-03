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
import { isSuperadmin } from '@/utils/permissions/permissions'
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

    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const includeDeleted = searchParams.get('includeDeleted') === 'true'
    
    const mediaService = getMediaService()
    const media = await mediaService.getById(id, includeDeleted)

    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }

    // Получаем настройки для s3PublicUrlPrefix
    const { prisma } = await import('@/libs/prisma')
    const globalSettings = await prisma.mediaGlobalSettings.findFirst({
      select: { s3PublicUrlPrefix: true }
    })
    const s3PublicUrlPrefix = globalSettings?.s3PublicUrlPrefix

    // Получаем URL для всех вариантов
    const variants = JSON.parse(media.variants || '{}')
    const urls: Record<string, string> = {}

    // Функция для формирования URL
    const buildUrl = (localPath: string | null, s3Key: string | null, variantName?: string): string => {
      // 1. Публичный S3 URL (если есть prefix)
      if (s3PublicUrlPrefix && s3Key) {
        const prefix = s3PublicUrlPrefix.endsWith('/') ? s3PublicUrlPrefix.slice(0, -1) : s3PublicUrlPrefix
        const key = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key
        return `${prefix}/${key}`
      }
      
      // 2. Локальный путь
      if (localPath) {
        let path = localPath.replace(/^public\//, '').replace(/^\//, '')
        while (path.startsWith('uploads/')) path = path.substring(8)
        return `/uploads/${path}`
      }
      
      // 3. Proxy URL (fallback)
      if (s3Key) {
        return variantName 
          ? `/api/admin/media/${id}/file?variant=${variantName}`
          : `/api/admin/media/${id}/file`
      }
      
      return ''
    }
    
    // URLs вариантов
    for (const name of Object.keys(variants)) {
      const variant = variants[name]
      const url = buildUrl(variant.localPath, variant.s3Key, name)
      if (url) urls[name] = url
    }

    // URL оригинала
    const originalUrl = buildUrl(media.localPath, media.s3Key)
    if (originalUrl) urls.original = originalUrl

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

    if (!isSuperadmin(user)) {
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
 * PATCH /api/admin/media/[id]
 * Восстановить медиа из корзины
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    
    // Проверяем действие
    if (body.action !== 'restore') {
      return NextResponse.json(
        { error: 'Invalid action. Use action: "restore"' },
        { status: 400 }
      )
    }

    const mediaService = getMediaService()
    
    // Восстанавливаем из корзины
    const media = await mediaService.restore(id)

    logger.info('[API] Media restored', {
      mediaId: id,
      restoredBy: user.id,
    })

    return NextResponse.json({
      success: true,
      media,
    })
  } catch (error) {
    logger.error('[API] PATCH /api/admin/media/[id] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to restore media' },
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

    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const hard = searchParams.get('hard') === 'true'

    const mediaService = getMediaService()
    // includeDeleted=true чтобы находить файлы в корзине для hard delete
    const media = await mediaService.getById(id, true)

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


