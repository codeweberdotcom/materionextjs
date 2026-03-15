/**
 * API: Watermark Preview - превью с водяным знаком
 * GET /api/admin/media/watermarks/[id]/preview - Сгенерировать превью
 *
 * @module app/api/admin/media/watermarks/[id]/preview
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isSuperadmin } from '@/utils/permissions/permissions'
import type { WatermarkPosition } from '@/services/media';
import { getWatermarkService } from '@/services/media'
import logger from '@/lib/logger'

/**
 * GET /api/admin/media/watermarks/[id]/preview
 * Сгенерировать превью с водяным знаком
 *
 * Query params:
 * - mediaId: ID исходного изображения (обязательно)
 * - position: позиция водяного знака (опционально)
 * - opacity: прозрачность 0-1 (опционально)
 * - scale: масштаб 0-1 (опционально)
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const { id: watermarkId } = params
    const { searchParams } = new URL(request.url)

    const mediaId = searchParams.get('mediaId')

    if (!mediaId) {
      return NextResponse.json({ error: 'mediaId is required' }, { status: 400 })
    }

    const position = searchParams.get('position') as WatermarkPosition | null
    const opacity = searchParams.get('opacity')
    const scale = searchParams.get('scale')

    const options: any = {}

    if (position) options.position = position
    if (opacity) options.opacity = parseFloat(opacity)
    if (scale) options.scale = parseFloat(scale)

    const watermarkService = getWatermarkService()

    const previewBuffer = await watermarkService.generatePreview(
      mediaId,
      watermarkId,
      Object.keys(options).length > 0 ? options : undefined
    )

    // Возвращаем изображение
    return new NextResponse(previewBuffer, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=300', // Кэшируем на 5 минут
        'Content-Length': previewBuffer.length.toString(),
      },
    })
  }
})
