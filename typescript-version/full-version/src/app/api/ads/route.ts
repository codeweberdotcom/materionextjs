import { NextRequest, NextResponse } from 'next/server'

import { rateLimitService } from '@/lib/rate-limit'
import { requireAuth } from '@/utils/auth/auth'
import { getRequestIp } from '@/utils/http/get-request-ip'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientIp = getRequestIp(request)
    const rateLimitResult = await rateLimitService.checkLimit(user.id, 'ads', {
      userId: user.id,
      email: user.email ?? null,
      ipAddress: clientIp,
      keyType: 'user'
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
