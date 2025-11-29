/**
 * API: Media Cleanup - ручной запуск очистки
 * POST /api/admin/media/cleanup - Запустить очистку
 * 
 * @module app/api/admin/media/cleanup
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { runMediaCleanup, runOrphanCleanup } from '@/services/media/jobs'
import logger from '@/lib/logger'

/**
 * POST /api/admin/media/cleanup
 * Запустить очистку
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
    const { type = 'soft_deleted', dryRun = false } = body

    logger.info('[API] Media cleanup requested', {
      type,
      dryRun,
      by: user.id,
    })

    let result

    switch (type) {
      case 'soft_deleted':
        result = await runMediaCleanup(dryRun)
        break

      case 'orphans':
        result = await runOrphanCleanup(dryRun)
        break

      case 'all':
        const softDeletedResult = await runMediaCleanup(dryRun)
        const orphansResult = await runOrphanCleanup(dryRun)
        result = {
          success: softDeletedResult.success && orphansResult.success,
          softDeleted: softDeletedResult,
          orphans: orphansResult,
        }
        break

      default:
        return NextResponse.json(
          { error: `Unknown cleanup type: ${type}. Use: soft_deleted, orphans, all` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    logger.error('[API] POST /api/admin/media/cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to run cleanup' },
      { status: 500 }
    )
  }
}

