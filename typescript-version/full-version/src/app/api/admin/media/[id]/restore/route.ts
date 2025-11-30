/**
 * API: Media Restore
 * POST /api/admin/media/[id]/restore - Восстановить медиа из корзины
 * 
 * @module app/api/admin/media/[id]/restore
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import { getMediaService } from '@/services/media'
import logger from '@/lib/logger'

/**
 * POST /api/admin/media/[id]/restore
 * Восстановить медиа из корзины
 */
export async function POST(
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
    
    // Check if media exists and is deleted
    const media = await mediaService.getById(id, true) // includeDeleted = true

    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }

    if (!media.deletedAt) {
      return NextResponse.json(
        { error: 'Media is not deleted' },
        { status: 400 }
      )
    }

    const restored = await mediaService.restore(id)

    logger.info('[API] Media restored', {
      mediaId: id,
      restoredBy: user.id,
    })

    return NextResponse.json({
      success: true,
      media: restored,
    })
  } catch (error) {
    logger.error('[API] POST /api/admin/media/[id]/restore failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to restore media' },
      { status: 500 }
    )
  }
}




