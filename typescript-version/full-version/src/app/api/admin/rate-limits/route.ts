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

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view')

    if (view === 'states') {
      const moduleName = searchParams.get('module') || undefined
      const limitParam = searchParams.get('limit')
      const cursor = searchParams.get('cursor') || undefined
      const search = searchParams.get('search') || undefined

      const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined
      const states = await rateLimitService.listStates({
        module: moduleName || undefined,
        cursor,
        search,
        limit: Number.isFinite(limit) ? limit : undefined
      })

      return NextResponse.json(states)
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
    const { module, maxRequests, windowMs, blockMs, warnThreshold, isActive, mode } = body

    if (!module) {
      return NextResponse.json({ error: 'Module is required' }, { status: 400 })
    }

    const fieldsProvided = [
      maxRequests,
      windowMs,
      blockMs,
      warnThreshold,
      typeof isActive === 'boolean' ? isActive : undefined
    ].some(value => value !== undefined)

    if (!fieldsProvided) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const updatePayload: Partial<{ maxRequests: number; windowMs: number; blockMs: number; warnThreshold: number; isActive: boolean; mode: 'monitor' | 'enforce' }> = {}

    if (maxRequests !== undefined) {
      if (typeof maxRequests !== 'number' || maxRequests <= 0) {
        return NextResponse.json({ error: 'Invalid maxRequests' }, { status: 400 })
      }
      updatePayload.maxRequests = maxRequests
    }

    if (windowMs !== undefined) {
      if (typeof windowMs !== 'number' || windowMs <= 0) {
        return NextResponse.json({ error: 'Invalid windowMs' }, { status: 400 })
      }
      updatePayload.windowMs = windowMs
    }

    if (blockMs !== undefined) {
      if (typeof blockMs !== 'number' || blockMs <= 0) {
        return NextResponse.json({ error: 'Invalid blockMs' }, { status: 400 })
      }
      updatePayload.blockMs = blockMs
    }

    if (warnThreshold !== undefined) {
      if (typeof warnThreshold !== 'number' || warnThreshold < 0) {
        return NextResponse.json({ error: 'Invalid warnThreshold' }, { status: 400 })
      }
      updatePayload.warnThreshold = warnThreshold
    }

    if (typeof isActive === 'boolean') {
      updatePayload.isActive = isActive
    }

    if (mode !== undefined) {
      if (mode !== 'monitor' && mode !== 'enforce') {
        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
      }
      updatePayload.mode = mode
    }

    await rateLimitService.updateConfig(module, updatePayload)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating rate limits:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
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


