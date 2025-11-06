import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth'

import { rateLimitService } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId } = body

    console.log('🔍 [API DEBUG] Check rate limit request:', { userId })

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check rate limit for chat messages
    const rateLimitResult = await rateLimitService.checkLimit(userId, 'chat')

    console.log('📊 [API DEBUG] Rate limit result:', {
      allowed: rateLimitResult.allowed,
      remaining: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime,
      blockedUntil: rateLimitResult.blockedUntil
    })

    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 1000)
      const blockedUntil = rateLimitResult.blockedUntil ? rateLimitResult.blockedUntil : new Date(Date.now() + (retryAfter * 1000))

      console.log('🚫 [API DEBUG] Rate limit exceeded:', {
        retryAfter,
        blockedUntil: blockedUntil.toISOString()
      })

      return NextResponse.json({
        error: 'Rate limit exceeded',
        retryAfter: retryAfter,
        blockedUntil: blockedUntil.toISOString()
      }, {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.getTime().toString()
        }
      })
    }

    console.log('✅ [API DEBUG] Rate limit check passed')

    return NextResponse.json({
      allowed: true,
      remaining: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime.toISOString()
    })
  } catch (error) {
    console.error('❌ [API DEBUG] Error in rate limit check:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}