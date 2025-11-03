import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { isSuperadmin, isAdmin } from '@/utils/permissions'
import { rateLimitService } from '@/lib/rate-limit'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(session.user as any) || isAdmin(session.user as any)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const configs = await rateLimitService.getAllConfigs()
    const stats = await Promise.all(
      ['chat', 'ads', 'upload', 'auth'].map(module => rateLimitService.getStats(module))
    )

    return NextResponse.json({
      configs,
      stats: stats.filter(Boolean)
    })
  } catch (error) {
    console.error('Error fetching rate limits:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(session.user as any) || isAdmin(session.user as any)
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
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(session.user as any) || isAdmin(session.user as any)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const module = searchParams.get('module')

    const success = await rateLimitService.resetLimits(key || undefined, module || undefined)

    if (!success) {
      return NextResponse.json({ error: 'Failed to reset limits' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting rate limits:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}