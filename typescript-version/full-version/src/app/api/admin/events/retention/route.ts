import { NextResponse } from 'next/server'

import { eventRetentionService } from '@/services/events/EventRetentionService'
import { withApiHandler } from '@/lib/api/withApiHandler'
import { checkPermission } from '@/utils/permissions/permissions'

export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    if (!checkPermission(user, 'events', 'read')) {
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
  }
})

export const GET = withApiHandler({
  handler: async ({ user }) => {
    if (!checkPermission(user, 'events', 'read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const stats = await eventRetentionService.getStats()

    return NextResponse.json(stats)
  }
})
