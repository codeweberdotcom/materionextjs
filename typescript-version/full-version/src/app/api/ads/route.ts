import { NextRequest, NextResponse } from 'next/server'

import { rateLimitContainer } from '@/lib/rate-limit/di/container'
import { requireAuth } from '@/utils/auth/auth'
import { requireFullVerification } from '@/utils/verification'
import { getRequestIp } from '@/utils/http/get-request-ip'
import { getEnvironmentFromRequest } from '@/lib/metrics/helpers'

export async function POST(request: NextRequest) {
  try {
    // Проверяем полную верификацию (email + phone) для создания объявлений
    const verificationCheck = await requireFullVerification(request)
    if (!verificationCheck.allowed) {
      return verificationCheck.response || NextResponse.json(
        { error: 'Full verification required (email and phone)' },
        { status: 403 }
      )
    }

    const { user } = verificationCheck

    const clientIp = getRequestIp(request)
    const environment = getEnvironmentFromRequest(request)
    const rateLimitResult = await rateLimitContainer.getRateLimitEngine().checkLimit(user.id, 'ads', {
      userId: user.id,
      email: user.email ?? null,
      ipAddress: clientIp,
      keyType: 'user',
      environment
    })

    if (!rateLimitResult.allowed) {
      const resetTimeMs = rateLimitResult.resetTime
      const blockedUntil = rateLimitResult.blockedUntil ?? resetTimeMs
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - Date.now()) / 1000))

      return NextResponse.json(
        {
          error: 'Ad rate limit exceeded. Please try again later.',
          retryAfter: retryAfterSeconds,
          blockedUntil
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfterSeconds.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(resetTimeMs).toISOString()
          }
        }
      )
    }

    // TODO: implement advertisement creation
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error creating ad:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
