/**
 * API: Watermarks - управление водяными знаками
 * GET /api/admin/media/watermarks - Получить список водяных знаков
 * POST /api/admin/media/watermarks - Создать водяной знак
 * 
 * @module app/api/admin/media/watermarks
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { getWatermarkService, WatermarkPosition } from '@/services/media'
import logger from '@/lib/logger'

/**
 * GET /api/admin/media/watermarks
 * Получить список водяных знаков
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
    const entityType = searchParams.get('entityType') || undefined

    const watermarkService = getWatermarkService()
    const watermarks = await watermarkService.getAvailableWatermarks(entityType)

    return NextResponse.json({ watermarks })
  } catch (error) {
    logger.error('[API] GET /api/admin/media/watermarks failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to fetch watermarks' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/media/watermarks
 * Создать водяной знак
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      displayName,
      description,
      mediaId,
      defaultPosition,
      defaultOpacity,
      defaultScale,
      entityTypes,
      isDefault,
    } = body

    if (!name || !displayName || !mediaId) {
      return NextResponse.json(
        { error: 'name, displayName, and mediaId are required' },
        { status: 400 }
      )
    }

    const watermarkService = getWatermarkService()
    const watermark = await watermarkService.createWatermark({
      name,
      displayName,
      description,
      mediaId,
      defaultPosition: defaultPosition as WatermarkPosition,
      defaultOpacity,
      defaultScale,
      entityTypes,
      isDefault,
    })

    logger.info('[API] Watermark created', {
      watermarkId: watermark.id,
      name,
      createdBy: user.id,
    })

    return NextResponse.json({
      success: true,
      watermark,
    })
  } catch (error) {
    logger.error('[API] POST /api/admin/media/watermarks failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to create watermark' },
      { status: 500 }
    )
  }
}


