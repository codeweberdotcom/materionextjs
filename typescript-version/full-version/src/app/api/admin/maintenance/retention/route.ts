import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isAdminByCode, isSuperadmin } from '@/utils/permissions/permissions'
import { getCronStatus, recordCronStatus, runRateLimitEventCleanup, getRetentionDays } from '@/lib/retention'
import logger from '@/lib/logger'

const CRON_NAME = 'retention_cleanup'

export const GET = withApiHandler({
  handler: async ({ user }) => {
    if (!isAdminByCode(user) && !isSuperadmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const status = await getCronStatus(CRON_NAME)

    return NextResponse.json({
      retentionDays: getRetentionDays(),
      status
    })
  }
})

export const POST = withApiHandler({
  handler: async ({ user }) => {
    if (!isAdminByCode(user) && !isSuperadmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await recordCronStatus(CRON_NAME, { lastRunAt: new Date(), lastResult: 'started' })
    const result = await runRateLimitEventCleanup()

    await recordCronStatus(CRON_NAME, {
      lastRunAt: new Date(),
      lastSuccessAt: new Date(),
      lastResult: result.message,
      lastCount: result.deleted
    })

    return NextResponse.json(result)
  }
})
