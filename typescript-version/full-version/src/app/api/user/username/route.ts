/**
 * API для управления username пользователя
 * 
 * GET /api/user/username - Получить информацию о username
 * PUT /api/user/username - Изменить username
 */

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { requireAuth } from '@/utils/auth/auth'
import { slugService } from '@/services/slug'
import { eventService } from '@/services/events'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

/**
 * GET - Получить информацию о username и возможности его смены
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        usernameChangedAt: true,
        name: true
      }
    })

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Проверяем возможность смены
    const canChange = await slugService.canChangeSlug('user', user.id)

    // Получаем историю slug
    const history = await slugService.getSlugHistory('user', user.id)

    return NextResponse.json({
      username: userData.username,
      usernameChangedAt: userData.usernameChangedAt,
      canChange: canChange.canChange,
      nextChangeDate: canChange.nextChangeDate,
      history: history.map(h => ({
        oldSlug: h.oldSlug,
        newSlug: h.newSlug,
        changedAt: h.changedAt
      }))
    })
  } catch (error) {
    console.error('Error getting username info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Изменить username
 */
export async function PUT(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    const body = await request.json()
    const { username: newUsername } = body

    if (!newUsername) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Получаем текущий username
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { username: true }
    })

    // Проверяем, изменился ли username
    if (userData?.username === newUsername) {
      return NextResponse.json({ 
        success: true,
        message: 'Username not changed (same value)',
        username: newUsername 
      })
    }

    // Пытаемся изменить username
    const result = await slugService.changeSlug(
      'user',
      user.id,
      newUsername,
      user.id, // changedBy = сам пользователь
      false // isAdmin = false (обычный пользователь)
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Записываем событие
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'user',
      module: 'profile',
      type: 'username_changed',
      severity: 'info',
      message: `Username changed from "${result.oldSlug}" to "${result.newSlug}"`,
      actor: { type: 'user', id: user.id },
      subject: { type: 'user', id: user.id },
      key: user.email || user.id,
      payload: {
        oldUsername: result.oldSlug,
        newUsername: result.newSlug
      }
    }))

    return NextResponse.json({
      success: true,
      message: 'Username changed successfully',
      oldUsername: result.oldSlug,
      newUsername: result.newSlug
    })
  } catch (error) {
    console.error('Error changing username:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

