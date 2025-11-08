// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'

import { rateLimitService } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // РџСЂРѕРІРµСЂСЏРµРј rate limit РґР»СЏ РѕР±СЉСЏРІР»РµРЅРёР№
    const rateLimitResult = await rateLimitService.checkLimit(user.id, 'ads')

    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded for ads',
        retryAfter: Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 1000),
        blockedUntil: rateLimitResult.blockedUntil?.toISOString()
      }, {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 1000).toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.getTime().toString()
        }
      })
    }

    // Р—РґРµСЃСЊ Р±СѓРґРµС‚ Р»РѕРіРёРєР° СЃРѕР·РґР°РЅРёСЏ РѕР±СЉСЏРІР»РµРЅРёСЏ
    // ...

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error creating ad:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


