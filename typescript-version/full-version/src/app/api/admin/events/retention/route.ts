import { NextRequest, NextResponse } from 'next/server'

import { eventRetentionService } from '@/services/events/EventRetentionService'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = checkPermission(user, 'events', 'read')

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check for admin permission for actual deletion
    const canDelete = checkPermission(user, 'events', 'delete') || checkPermission(user, 'admin', 'maintenance')

    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get('dryRun') === 'true'
    const source = searchParams.get('source') || undefined

    if (!canDelete && !dryRun) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Use dryRun=true to preview changes.' },
        { status: 403 }
      )
    }

    if (source) {
      // Clean specific source
      const result = await eventRetentionService.cleanSource(source, dryRun)

      return NextResponse.json({
        success: true,
        dryRun,
        result
      })
    } else {
      // Clean all sources
      const result = await eventRetentionService.cleanAll(dryRun)

      return NextResponse.json({
        success: true,
        dryRun,
        ...result
      })
    }
  } catch (error) {
    logger.error('Failed to run event retention', {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = checkPermission(user, 'events', 'read')

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const stats = await eventRetentionService.getStats()

    return NextResponse.json(stats)
  } catch (error) {
    logger.error('Failed to get event retention stats', {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}








