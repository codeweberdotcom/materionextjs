/**
 * API: Public Media - публичный доступ к медиа
 * GET /api/media/[id] - Получить публичную информацию о медиа
 * 
 * Этот endpoint НЕ требует авторизации и возвращает только публичные URL
 * Для использования на фронтенде
 * 
 * @module app/api/media/[id]
 */

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { getPublicMediaUrl, getPublicVariantUrl } from '@/utils/media'
import logger from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/media/[id]
 * Получить публичную информацию о медиа (без авторизации)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const variant = searchParams.get('variant') || undefined

    // Получаем media из БД
    const media = await prisma.media.findUnique({
      where: { 
        id,
        deletedAt: null, // Только не удалённые
      },
      select: {
        id: true,
        filename: true,
        slug: true,
        localPath: true,
        s3Key: true,
        s3Bucket: true,
        mimeType: true,
        size: true,
        width: true,
        height: true,
        alt: true,
        title: true,
        caption: true,
        variants: true,
        entityType: true,
      },
    })

    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }

    // Получаем настройки для publicUrlPrefix
    const globalSettings = await prisma.mediaGlobalSettings.findFirst({
      select: {
        s3PublicUrlPrefix: true,
        s3Enabled: true,
      },
    })

    // Используем S3 URL только если S3 включен
    const s3PublicUrlPrefix = globalSettings?.s3Enabled 
      ? globalSettings?.s3PublicUrlPrefix 
      : null

    // Формируем URLs
    const urls: Record<string, string> = {}
    
    // URL оригинала
    urls.original = getPublicMediaUrl({
      id: media.id,
      localPath: media.localPath,
      s3Key: media.s3Key,
      s3PublicUrlPrefix,
    })

    // URLs вариантов
    if (media.variants) {
      try {
        const variants = JSON.parse(media.variants)
        for (const name of Object.keys(variants)) {
          urls[name] = getPublicVariantUrl(media, name, s3PublicUrlPrefix)
        }
      } catch {
        // Игнорируем
      }
    }

    // Если запрошен конкретный вариант - возвращаем редирект
    if (variant) {
      const url = urls[variant] || urls.original
      
      // Если это внешний URL (CDN) - редирект
      if (url.startsWith('http')) {
        return NextResponse.redirect(url)
      }
      
      // Если локальный - редирект на локальный путь
      return NextResponse.redirect(new URL(url, request.url))
    }

    // Возвращаем информацию о медиа
    return NextResponse.json({
      id: media.id,
      filename: media.filename,
      slug: media.slug,
      mimeType: media.mimeType,
      size: media.size,
      width: media.width,
      height: media.height,
      alt: media.alt,
      title: media.title,
      caption: media.caption,
      urls,
    })
  } catch (error) {
    logger.error('[API] GET /api/media/[id] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to get media' },
      { status: 500 }
    )
  }
}

