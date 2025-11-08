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

    // РџСЂРѕРІРµСЂСЏРµРј rate limit РґР»СЏ С‡Р°С‚Р°
    const rateLimitResult = await rateLimitService.checkLimit(user.id, 'chat')

    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
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

    // Р—РґРµСЃСЊ Р±СѓРґРµС‚ Р»РѕРіРёРєР° РѕС‚РїСЂР°РІРєРё СЃРѕРѕР±С‰РµРЅРёСЏ
    // ...

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


