import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { rateLimitService } from '@/lib/rate-limit'
import logger from '@/lib/logger'

export const GET = withApiHandler({
  handler: async ({ user }) => {
    // Check if user has admin permissions
    if (!user.role?.permissions?.includes('rate_limits.read')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    logger.info('[rate-limit] Health check requested', { userId: user.id })

    // Get health status from the rate limit service
    const healthStatus = await rateLimitService.healthCheck()

    return NextResponse.json({
      status: healthStatus.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: healthStatus.services
    })
  }
})
