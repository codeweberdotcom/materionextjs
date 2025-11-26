import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { rateLimitService } from '@/lib/rate-limit'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

  } catch (error) {
    logger.error('[rate-limit] Health check failed', {
      error: error instanceof Error ? error.message : error,
      file: 'src/app/api/admin/rate-limits/health/route.ts'
    })

    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}