import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'

import { isSuperadmin, isAdmin } from '@/utils/permissions/permissions'
import { rateLimitService } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(user as UserWithRole) || isAdmin(user as UserWithRole)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const configs = await rateLimitService.getAllConfigs()
    const stats = await Promise.all(
      ['chat', 'ads', 'upload', 'auth'].map((module: any) => rateLimitService.getStats(module))
    )

    return NextResponse.json({
      configs,
      stats: stats.filter((item: any) => Boolean)
    })
  } catch (error) {
    console.error('Error fetching rate limits:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(user as UserWithRole) || isAdmin(user as UserWithRole)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { module, maxRequests, windowMs, blockMs } = body

    if (!module || typeof maxRequests !== 'number' || typeof windowMs !== 'number' || typeof blockMs !== 'number') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const success = await rateLimitService.updateConfig(module, {
      maxRequests,
      windowMs,
      blockMs
    })

    if (!success) {
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating rate limits:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(user as UserWithRole) || isAdmin(user as UserWithRole)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const moduleName = searchParams.get('module')

    const success = await rateLimitService.resetLimits(key || undefined, moduleName || undefined)

    if (!success) {
      return NextResponse.json({ error: 'Failed to reset limits' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting rate limits:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


