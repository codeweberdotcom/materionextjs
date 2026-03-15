import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { rateLimitService } from '@/lib/rate-limit'
import logger from '@/lib/logger'
import { getEnvironmentFromRequest } from '@/lib/metrics/helpers'

const CHAT_MODULE = 'chat-messages'

export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    const body = await request.json()
    const { userId } = body

    logger.info('📝 [API DEBUG] Check rate limit request:', { userId })

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const environment = getEnvironmentFromRequest(request) as 'production' | 'test' | undefined

    const rateLimitResult = await rateLimitService.checkLimit(userId, 'chat-messages', {
      increment: false,
      userId,
      email: user.email ?? null,
      keyType: 'user',
      environment
    })

    logger.info('📊 [API DEBUG] Rate limit result:', {
      allowed: rateLimitResult.allowed,
      remaining: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime,
      blockedUntil: rateLimitResult.blockedUntil
    })

    const respondWithBlock = (blockedUntilMs: number) => {
      const retryAfterSec = Math.max(1, Math.ceil((blockedUntilMs - Date.now()) / 1000))

      logger.info('🚫 [API DEBUG] Rate limit exceeded:', {
        retryAfter: retryAfterSec,
        blockedUntil: blockedUntilMs
      })

      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          blockedUntilMs,
          retryAfterSec,
          remaining: rateLimitResult.remaining,

          // Legacy for compatibility
          retryAfter: retryAfterSec,
          blockedUntil: blockedUntilMs
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfterSec.toString(),
            'X-RateLimit-Remaining': Math.max(0, rateLimitResult.remaining).toString(),
            'X-RateLimit-Reset': blockedUntilMs.toString()
          }
        }
      )
    }

    if (!rateLimitResult.allowed && rateLimitResult.blockedUntil) {
      return respondWithBlock(rateLimitResult.blockedUntil)
    }

    if (!rateLimitResult.allowed) {
      return respondWithBlock(rateLimitResult.resetTime)
    }

    if (rateLimitResult.remaining <= 0) {
      const config = await rateLimitService.getConfig(CHAT_MODULE)

      logger.info('⚠️ [API DEBUG] Rate limit exhausted, mode check', { mode: config?.mode })

      if (config?.mode === 'monitor') {
        const warningRemaining = rateLimitResult.warning?.remaining ?? 0
        const resetTimeMs = rateLimitResult.resetTime

        logger.info('⚠️ [API DEBUG] Monitor mode — returning warning only', { warningRemaining, resetTimeMs })

        return NextResponse.json({
          allowed: true,
          remaining: null,
          resetTime: resetTimeMs,
          warning: {
            remaining: warningRemaining,
            blockedUntil: resetTimeMs,
            blockedUntilMs: resetTimeMs
          }
        })
      }

      const blockMs = config?.blockMs ?? config?.windowMs ?? 60000
      const simulatedBlockEnd = Date.now() + blockMs

      logger.info('🚫 [API DEBUG] Enforce mode — responding with simulated block', {
        blockMs,
        simulatedBlockEnd
      })

      return respondWithBlock(rateLimitResult.blockedUntil ?? simulatedBlockEnd)
    }

    logger.info('✅ [API DEBUG] Rate limit check passed')

    return NextResponse.json({
      allowed: true,
      remaining: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime,
      warning: rateLimitResult.warning
        ? {
            ...rateLimitResult.warning,
            blockedUntil: rateLimitResult.resetTime,
            blockedUntilMs: rateLimitResult.resetTime
          }
        : null
    })
  }
})
