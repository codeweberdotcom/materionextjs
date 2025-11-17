import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isAdmin, isSuperadmin } from '@/utils/permissions/permissions'
import { rateLimitService } from '@/lib/rate-limit'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(user) || isAdmin(user)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)

    if (!body) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const {
      module,
      targetType,
      userId,
      email,
      ipAddress,
      reason,
      durationMinutes,
      notes,
      overwrite
    } = body as {
      module?: string
      targetType?: 'user' | 'ip' | 'email'
      userId?: string
      email?: string
      ipAddress?: string
      reason?: string
      durationMinutes?: number
      notes?: string
      overwrite?: boolean
    }

    if (!module) {
      return NextResponse.json({ error: 'Module is required' }, { status: 400 })
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
    }

    const normalizedTargetType = targetType === 'ip' ? 'ip' : targetType === 'email' ? 'email' : 'user'
    const trimmedUserId = typeof userId === 'string' ? userId.trim() : ''
    const trimmedEmail = typeof email === 'string' ? email.trim() : ''
    const trimmedIp = typeof ipAddress === 'string' ? ipAddress.trim() : ''

    if (normalizedTargetType === 'user' && !trimmedUserId) {
      return NextResponse.json({ error: 'User ID is required for user blocks' }, { status: 400 })
    }

    if (normalizedTargetType === 'email' && !trimmedEmail) {
      return NextResponse.json({ error: 'Email is required for email blocks' }, { status: 400 })
    }

    if (normalizedTargetType === 'ip' && !trimmedIp) {
      return NextResponse.json({ error: 'IP address is required for IP blocks' }, { status: 400 })
    }

    const duration =
      typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) && durationMinutes > 0
        ? durationMinutes * 60_000
        : undefined

    const block = await rateLimitService.createManualBlock({
      module,
      reason: reason.trim(),
      blockedBy: user.id,
      userId: normalizedTargetType === 'user' ? trimmedUserId : undefined,
      email: normalizedTargetType === 'email' ? trimmedEmail : undefined,
      ipAddress: normalizedTargetType === 'ip' ? trimmedIp : undefined,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : undefined,
      durationMs: duration,
      overwrite: overwrite === true
    })

    return NextResponse.json({ success: true, block })
  } catch (error) {
    if (error instanceof Error && (error as any).code === 'BLOCK_EXISTS') {
      return NextResponse.json({ error: 'Block already exists for this target', code: 'block_exists' }, { status: 409 })
    }
    logger.error('Error creating manual block', {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
