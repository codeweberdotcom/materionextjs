import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isAdminByCode, isSuperadmin } from '@/utils/permissions/permissions'
import { rateLimitService } from '@/lib/rate-limit'
import logger from '@/lib/logger'

const parseDateParam = (value: string | null) => {
  if (!value) {
    return undefined
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(user) || isAdminByCode(user)

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    const moduleParam = searchParams.get('module')
    const eventTypeParam = searchParams.get('eventType')
    const modeParam = searchParams.get('mode')
    const search = searchParams.get('search') || undefined
    const keyParam = searchParams.get('key') || undefined
    const limitParam = searchParams.get('limit')
    const cursor = searchParams.get('cursor') || undefined
    const from = parseDateParam(searchParams.get('from'))
    const to = parseDateParam(searchParams.get('to'))

    const isSuperAdminFlag = isSuperadmin(user)
    logger.info('[rate-limit] API call', { userId: user.id, isSuperAdmin: isSuperAdminFlag })

    const result = await rateLimitService.listEvents({
      module: moduleParam || undefined,
      eventType: eventTypeParam === 'warning' || eventTypeParam === 'block' ? eventTypeParam : undefined,
      mode: modeParam === 'monitor' || modeParam === 'enforce' ? modeParam : undefined,
      key: keyParam,
      search,
      limit: limitParam && Number.isFinite(Number.parseInt(limitParam, 10)) ? Number.parseInt(limitParam, 10) : undefined,
      cursor,
      from,
      to
    }, isSuperAdminFlag) // Pass superadmin flag

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error fetching rate limit events', {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
