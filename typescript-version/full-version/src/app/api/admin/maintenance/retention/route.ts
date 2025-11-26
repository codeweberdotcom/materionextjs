import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isAdminByCode, isSuperadmin } from '@/utils/permissions/permissions'
import { getCronStatus, recordCronStatus, runRateLimitEventCleanup, getRetentionDays } from '@/lib/retention'
import logger from '@/lib/logger'

const CRON_NAME = 'retention_cleanup'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user || (!isAdminByCode(user) && !isSuperadmin(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const status = await getCronStatus(CRON_NAME)
    return NextResponse.json({
      retentionDays: getRetentionDays(),
      status
    })
  } catch (error) {
    logger.error('Failed to fetch retention status', {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user || (!isAdminByCode(user) && !isSuperadmin(user))) {
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
  } catch (error) {
    logger.error('Failed to run retention cleanup', {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    })
    await recordCronStatus(CRON_NAME, { lastRunAt: new Date(), lastResult: 'error' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
