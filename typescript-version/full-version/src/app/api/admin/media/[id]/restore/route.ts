/**
 * API: Media Restore
 * POST /api/admin/media/[id]/restore - Восстановить медиа из корзины
 *
 * @module app/api/admin/media/[id]/restore
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import { getMediaService } from '@/services/media'
import logger from '@/lib/logger'

/**
 * POST /api/admin/media/[id]/restore
 * Восстановить медиа из корзины
 */
export const POST = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    if (!isAdminOrHigher(user)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { id } = params
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
  }
})
