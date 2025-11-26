/**
 * API: Watermark по ID
 * GET /api/admin/media/watermarks/[id] - Получить водяной знак
 * PUT /api/admin/media/watermarks/[id] - Обновить водяной знак
 * DELETE /api/admin/media/watermarks/[id] - Удалить водяной знак
 * 
 * @module app/api/admin/media/watermarks/[id]
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { getWatermarkService, WatermarkPosition } from '@/services/media'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

/**
 * GET /api/admin/media/watermarks/[id]
 * Получить водяной знак по ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const { id } = await params
    const watermark = await prisma.watermark.findUnique({
      where: { id },
    })

    if (!watermark) {
      return NextResponse.json(
        { error: 'Watermark not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ watermark })
  } catch (error) {
    logger.error('[API] GET /api/admin/media/watermarks/[id] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to fetch watermark' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/media/watermarks/[id]
 * Обновить водяной знак
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const { id } = await params
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
  } catch (error) {
    logger.error('[API] PUT /api/admin/media/watermarks/[id] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to update watermark' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/media/watermarks/[id]
 * Удалить водяной знак
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const { id } = await params

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
  } catch (error) {
    logger.error('[API] DELETE /api/admin/media/watermarks/[id] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to delete watermark' },
      { status: 500 }
    )
  }
}

