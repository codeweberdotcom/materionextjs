import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { isSuperadmin, isAdminByCode } from '@/utils/permissions/permissions'
import { rateLimitService } from '@/lib/rate-limit'
import type { RateLimitStats } from '@/lib/rate-limit'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(user) || isAdminByCode(user)
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
    if (view === 'events') {
      const moduleName = searchParams.get('module') || undefined
      const key = searchParams.get('key') || undefined
      const eventTypeParam = (searchParams.get('eventType') || 'block').toLowerCase()
      const limitParam = searchParams.get('limit')
      const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined

      if (!moduleName || !key) {
        return NextResponse.json({ error: 'module and key are required for events view' }, { status: 400 })
      }

      const allowedEventTypes = ['warning', 'block'] as const
      const eventType = allowedEventTypes.includes(eventTypeParam as any) ? (eventTypeParam as 'warning' | 'block') : 'block'

      const events = await rateLimitService.listEvents({
        module: moduleName,
        key,
        eventType,
        limit: Number.isFinite(limit) ? limit : 20
      })

      return NextResponse.json(events)
    }

    const configs = await rateLimitService.getAllConfigs()
    const modules: Array<
      | 'chat-messages'
      | 'chat-rooms'
      | 'chat-connections'
      | 'ads'
      | 'upload'
      | 'auth'
      | 'registration-ip'
      | 'registration-domain'
      | 'registration-email'
    > = [
      'chat-messages',
      'chat-rooms',
      'chat-connections',
      'ads',
      'upload',
      'auth',
      'registration-ip',
      'registration-domain',
      'registration-email'
    ]
    const stats = await Promise.all(modules.map(module => rateLimitService.getStats(module)))
    const filteredStats = stats.filter((stat): stat is RateLimitStats => Boolean(stat))

    return NextResponse.json({
      configs,
      stats: filteredStats
    })
  } catch (error) {
    logger.error('Error fetching rate limits', {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(user) || isAdminByCode(user)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      module,
      maxRequests,
      windowMs,
      blockMs,
      warnThreshold,
      isActive,
      mode,
      storeEmailInEvents,
      storeIpInEvents
    } = body

    if (!module) {
      return NextResponse.json({ error: 'Module is required' }, { status: 400 })
    }

    const fieldsProvided = [
      maxRequests,
      windowMs,
      blockMs,
      warnThreshold,
      typeof isActive === 'boolean' ? isActive : undefined,
      mode,
      typeof storeEmailInEvents === 'boolean' ? storeEmailInEvents : undefined,
      typeof storeIpInEvents === 'boolean' ? storeIpInEvents : undefined
    ].some(value => value !== undefined)

    if (!fieldsProvided) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const updatePayload: Partial<{
      maxRequests: number
      windowMs: number
      blockMs: number
      warnThreshold: number
      isActive: boolean
      mode: 'monitor' | 'enforce'
      storeEmailInEvents: boolean
      storeIpInEvents: boolean
    }> = {}

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

    if (storeEmailInEvents !== undefined) {
      if (typeof storeEmailInEvents !== 'boolean') {
        return NextResponse.json({ error: 'Invalid storeEmailInEvents' }, { status: 400 })
      }
      updatePayload.storeEmailInEvents = storeEmailInEvents
    }

    if (storeIpInEvents !== undefined) {
      if (typeof storeIpInEvents !== 'boolean') {
        return NextResponse.json({ error: 'Invalid storeIpInEvents' }, { status: 400 })
      }
      updatePayload.storeIpInEvents = storeIpInEvents
    }

    const previousConfig = await rateLimitService.getConfig(module)
    await rateLimitService.updateConfig(module, updatePayload)
    const updatedConfig = await rateLimitService.getConfig(module)
    if (
      updatedConfig?.mode === 'monitor' &&
      previousConfig?.mode === 'enforce'
    ) {
      await rateLimitService.resetLimits(undefined, module)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error updating rate limits', {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(user) || isAdminByCode(user)
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
    logger.error('Error resetting rate limits', {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
