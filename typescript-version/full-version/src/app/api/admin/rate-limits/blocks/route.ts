import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isAdminByCode, isSuperadmin } from '@/utils/permissions/permissions'
import { rateLimitService } from '@/lib/rate-limit'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(user) || isAdminByCode(user)
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
      mailDomain,
      ipAddress,
      reason,
      durationMinutes,
      notes,
      overwrite
    } = body as {
      module?: string
      targetType?: 'user' | 'ip' | 'email' | 'domain'
      userId?: string
      email?: string
      mailDomain?: string
      ipAddress?: string
      reason?: string
      durationMinutes?: number
      notes?: string
      overwrite?: boolean
    }

    const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    const isValidDomain = (value: string) => /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)
    const isValidIp = (value: string) =>
      /^(\d{1,3}\.){3}\d{1,3}$/.test(value) ||
      /^[\da-fA-F:]+$/.test(value)

    if (!module) {
      return NextResponse.json({ error: 'Module is required' }, { status: 400 })
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
    }

    const normalizedTargetType =
      targetType === 'ip' ? 'ip' : targetType === 'email' ? 'email' : targetType === 'domain' ? 'domain' : 'user'
    const trimmedUserId = typeof userId === 'string' ? userId.trim() : ''
    const trimmedEmail = typeof email === 'string' ? email.trim() : ''
    const trimmedIp = typeof ipAddress === 'string' ? ipAddress.trim() : ''
    const trimmedDomain =
      typeof mailDomain === 'string' ? mailDomain.replace(/^\*@/, '').replace(/^@/, '').trim() : ''

    if (normalizedTargetType === 'user' && !trimmedUserId) {
      return NextResponse.json({ error: 'User ID is required for user blocks' }, { status: 400 })
    }

    if (normalizedTargetType === 'email') {
      if (!trimmedEmail) {
        return NextResponse.json({ error: 'Email is required for email blocks' }, { status: 400 })
      }
      if (!isValidEmail(trimmedEmail)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
    }

    if (normalizedTargetType === 'domain') {
      if (!trimmedDomain) {
        return NextResponse.json({ error: 'Domain is required for domain blocks' }, { status: 400 })
      }
      if (!isValidDomain(trimmedDomain)) {
        return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 })
      }
    }

    if (normalizedTargetType === 'ip') {
      if (!trimmedIp) {
        return NextResponse.json({ error: 'IP address is required for IP blocks' }, { status: 400 })
      }
      if (!isValidIp(trimmedIp)) {
        return NextResponse.json({ error: 'Invalid IP address' }, { status: 400 })
      }
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
      mailDomain: normalizedTargetType === 'domain' ? trimmedDomain : undefined,
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
