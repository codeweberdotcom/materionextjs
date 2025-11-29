/**
 * Admin API для управления username пользователя
 * 
 * PUT /api/admin/users/[id]/username - Принудительно изменить username (без ограничений)
 */

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { requireAuth } from '@/lib/auth/api-helpers'
import { checkPermission } from '@/lib/permissions'
import { slugService } from '@/services/slug'
import { eventService } from '@/services/events'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PUT - Принудительно изменить username (администратор)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { user: admin } = await requireAuth(request)
    const { id: userId } = await params
    const body = await request.json()
    const { username: newUsername } = body

    // Проверяем права администратора
    const hasPermission = await checkPermission(admin.id, 'users', 'edit')
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Access denied. Admin permission required.' },
        { status: 403 }
      )
    }

    if (!newUsername) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Проверяем существование пользователя
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true, email: true }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Проверяем, изменился ли username
    if (targetUser.username === newUsername) {
      return NextResponse.json({ 
        success: true,
        message: 'Username not changed (same value)',
        username: newUsername 
      })
    }

    // Изменяем username (isAdmin = true - без ограничений по времени)
    const result = await slugService.changeSlug(
      'user',
      userId,
      newUsername,
      admin.id, // changedBy = администратор
      true // isAdmin = true (без ограничений)
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Записываем событие
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'admin',
      module: 'users',
      type: 'username_changed_by_admin',
      severity: 'info',
      message: `Admin changed username for user "${targetUser.name || targetUser.email}" from "${result.oldSlug}" to "${result.newSlug}"`,
      actor: { type: 'user', id: admin.id },
      subject: { type: 'user', id: userId },
      key: targetUser.email || userId,
      payload: {
        targetUserId: userId,
        targetUserName: targetUser.name,
        targetUserEmail: targetUser.email,
        oldUsername: result.oldSlug,
        newUsername: result.newSlug,
        adminId: admin.id
      }
    }))

    return NextResponse.json({
      success: true,
      message: 'Username changed successfully by admin',
      oldUsername: result.oldSlug,
      newUsername: result.newSlug
    })
  } catch (error) {
    console.error('Error changing username by admin:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

