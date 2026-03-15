/**
 * API: Watermark по ID
 * GET /api/admin/media/watermarks/[id] - Получить водяной знак
 * PUT /api/admin/media/watermarks/[id] - Обновить водяной знак
 * DELETE /api/admin/media/watermarks/[id] - Удалить водяной знак
 *
 * @module app/api/admin/media/watermarks/[id]
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isSuperadmin } from '@/utils/permissions/permissions'
import type { WatermarkPosition } from '@/services/media';
import { getWatermarkService } from '@/services/media'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

/**
 * GET /api/admin/media/watermarks/[id]
 * Получить водяной знак по ID
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const { id } = params

    const watermark = await prisma.watermark.findUnique({
      where: { id },
    })

    if (!watermark) {
      return NextResponse.json({ error: 'Watermark not found' }, { status: 404 })
    }

    return NextResponse.json({ watermark })
  }
})

/**
 * PUT /api/admin/media/watermarks/[id]
 * Обновить водяной знак
 */
export const PUT = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const { id } = params
    const body = await request.json()

    const watermarkService = getWatermarkService()

    const watermark = await watermarkService.updateWatermark(id, {
      displayName: body.displayName,
      description: body.description,
      mediaId: body.mediaId,
      defaultPosition: body.defaultPosition as WatermarkPosition,
      defaultOpacity: body.defaultOpacity,
      defaultScale: body.defaultScale,
      entityTypes: body.entityTypes,
      isDefault: body.isDefault,
      isActive: body.isActive,
    })

    logger.info('[API] Watermark updated', {
      watermarkId: id,
      updatedBy: user.id,
    })

    return NextResponse.json({
      success: true,
      watermark,
    })
  }
})

/**
 * DELETE /api/admin/media/watermarks/[id]
 * Удалить водяной знак
 */
export const DELETE = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const { id } = params
    const watermarkService = getWatermarkService()

    await watermarkService.deleteWatermark(id)

    logger.info('[API] Watermark deleted', {
      watermarkId: id,
      deletedBy: user.id,
    })

    return NextResponse.json({
      success: true,
      message: 'Watermark deleted',
    })
  }
})
