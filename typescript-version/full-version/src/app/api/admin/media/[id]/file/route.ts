/**
 * API: Media File - получение файла по ID
 * GET /api/admin/media/[id]/file - Получить файл (проксирование с S3 или локального)
 *
 * @module app/api/admin/media/[id]/file
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { getStorageService } from '@/services/media'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

/**
 * GET /api/admin/media/[id]/file
 * Получить файл (проксирование для избежания CORS проблем)
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const { id } = params
    const { searchParams } = new URL(request.url)
    const variantName = searchParams.get('variant') || undefined

    // Получаем media из БД
    const media = await prisma.media.findUnique({ where: { id } })

    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }

    const storageService = await getStorageService()

    // Для вариантов создаём виртуальный Media объект
    let mediaToDownload = media
    let mimeType = media.mimeType

    if (variantName && media.variants) {
      const variants = JSON.parse(media.variants)
      const variant = variants[variantName]

      if (variant) {
        // Создаём виртуальный объект для скачивания варианта
        mediaToDownload = {
          ...media,
          localPath: variant.localPath || null,
          s3Key: variant.s3Key || null,
        } as typeof media
        mimeType = variant.mimeType || media.mimeType
      }
    }

    if (!mediaToDownload.localPath && !mediaToDownload.s3Key) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Скачиваем файл
    const buffer = await storageService.download(mediaToDownload)

    // Определяем Content-Type
    const contentType = mimeType || 'application/octet-stream'

    // Возвращаем файл
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }
})
