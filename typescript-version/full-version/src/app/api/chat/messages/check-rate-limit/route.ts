import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'

import { rateLimitService } from '@/lib/rate-limit'
import logger from '@/lib/logger'

const CHAT_MODULE = 'chat'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId } = body

    logger.info('рџ”Ќ [API DEBUG] Check rate limit request:', { userId })

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const rateLimitResult = await rateLimitService.checkLimit(userId, CHAT_MODULE, {
      increment: false,
      userId,
      email: user.email ?? null,
      keyType: 'user'
    })

    logger.info('рџ“Љ [API DEBUG] Rate limit result:', {
      allowed: rateLimitResult.allowed,
      remaining: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime,
      blockedUntil: rateLimitResult.blockedUntil
    })

    const respondWithBlock = (blockedUntil: number) => {
      const retryAfter = Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1000))

      logger.info('рџљ« [API DEBUG] Rate limit exceeded:', {
        retryAfter,
        blockedUntil
      })

      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter,
          blockedUntil
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Remaining': Math.max(0, rateLimitResult.remaining).toString(),
            'X-RateLimit-Reset': blockedUntil.toString()
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
      const config = rateLimitService.getConfig(CHAT_MODULE)

      logger.info('⚠️ [API DEBUG] Rate limit exhausted, mode check', { mode: config?.mode })

      const enforceResult = await rateLimitService.checkLimit(userId, CHAT_MODULE, {
        increment: true,
        userId,
        email: user.email ?? null,
        keyType: 'user'
      })

      if (config?.mode === 'monitor') {
        const warningRemaining = enforceResult.warning?.remaining ?? 0
        const resetTimeMs = enforceResult.resetTime
        logger.info('⚠️ [API DEBUG] Monitor mode — returning warning only', { warningRemaining, resetTimeMs })
        return NextResponse.json({
          allowed: true,
          remaining: null,
          resetTime: resetTimeMs,
          warning: {
            remaining: warningRemaining,
            blockedUntil: resetTimeMs
          }
        })
      }

      if (!enforceResult.allowed && enforceResult.blockedUntil) {
        return respondWithBlock(enforceResult.blockedUntil)
      }

      const blockMs = config?.blockMs ?? config?.windowMs ?? 60000
      const simulatedBlockEnd = Date.now() + blockMs
      return respondWithBlock(enforceResult.blockedUntil ?? simulatedBlockEnd)
    }

    logger.info('вњ… [API DEBUG] Rate limit check passed')

    return NextResponse.json({
      allowed: true,
      remaining: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime,
      warning: rateLimitResult.warning || null
    })
  } catch (error) {
    console.error('вќЊ [API DEBUG] Error in rate limit check:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
