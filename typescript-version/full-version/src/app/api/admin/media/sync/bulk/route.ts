/**
 * API: Bulk operations for Media Sync Jobs
 * DELETE /api/admin/media/sync/bulk - Delete multiple sync jobs
 * 
 * @module app/api/admin/media/sync/bulk
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'
import { eventService } from '@/services/events'

/**
 * DELETE /api/admin/media/sync/bulk
 * Delete multiple sync jobs
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { jobIds } = body as { jobIds: string[] }

    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json(
        { error: 'jobIds array is required' },
        { status: 400 }
      )
    }

    // First, delete all child jobs (if any parent jobs are selected)
    const parentJobs = await prisma.mediaSyncJob.findMany({
      where: {
        id: { in: jobIds },
        isParent: true
      },
      select: { id: true }
    })

    const parentJobIds = parentJobs.map(j => j.id)

    // Delete child jobs first
    if (parentJobIds.length > 0) {
      await prisma.mediaSyncJob.deleteMany({
        where: {
          parentJobId: { in: parentJobIds }
        }
      })
    }

    // Delete the selected jobs
    const deleteResult = await prisma.mediaSyncJob.deleteMany({
      where: {
        id: { in: jobIds }
      }
    })

    logger.info('[API] Bulk delete sync jobs', {
      deletedCount: deleteResult.count,
      requestedCount: jobIds.length,
      deletedBy: user.id,
    })

    // Record event
    await eventService.record({
      source: 'media',
      module: 'media',
      type: 'media.sync_jobs_deleted',
      severity: 'warning',
      message: `Удалено ${deleteResult.count} задач синхронизации`,
      payload: {
        deletedCount: deleteResult.count,
        jobIds: jobIds.slice(0, 10), // Limit to first 10 for logging
      },
      actor: { type: 'user', id: user.id },
    })

    return NextResponse.json({
      success: true,
      deleted: deleteResult.count,
      requested: jobIds.length,
    })
  } catch (error) {
    logger.error('[API] DELETE /api/admin/media/sync/bulk failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete jobs' },
      { status: 500 }
    )
  }
}


