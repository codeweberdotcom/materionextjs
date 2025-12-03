/**
 * API для управления slug аккаунта (компании)
 * 
 * GET /api/account/[id]/slug - Получить информацию о slug
 * PUT /api/account/[id]/slug - Изменить slug
 */

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { requireAuth } from '@/utils/auth/auth'
import { slugService } from '@/services/slug'
import { eventService } from '@/services/events'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET - Получить информацию о slug и возможности его смены
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(request)
    const { id: accountId } = await params

    // Проверяем доступ к аккаунту
    const account = await prisma.userAccount.findFirst({
      where: {
        id: accountId,
        OR: [
          { userId: user.id },
          { ownerId: user.id },
          {
            managers: {
              some: {
                userId: user.id,
                canManage: true,
                revokedAt: null
              }
            }
          }
        ]
      },
      select: {
        id: true,
        slug: true,
        slugChangedAt: true,
        name: true
      }
    })

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found or access denied' },
        { status: 404 }
      )
    }

    // Проверяем возможность смены
    const canChange = await slugService.canChangeSlug('account', accountId)

    // Получаем историю slug
    const history = await slugService.getSlugHistory('account', accountId)

    return NextResponse.json({
      slug: account.slug,
      slugChangedAt: account.slugChangedAt,
      canChange: canChange.canChange,
      nextChangeDate: canChange.nextChangeDate,
      history: history.map(h => ({
        oldSlug: h.oldSlug,
        newSlug: h.newSlug,
        changedAt: h.changedAt
      }))
    })
  } catch (error) {
    console.error('Error getting account slug info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Изменить slug аккаунта
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(request)
    const { id: accountId } = await params
    const body = await request.json()
    const { slug: newSlug } = body

    if (!newSlug) {
      return NextResponse.json(
        { error: 'Slug is required' },
        { status: 400 }
      )
    }

    // Проверяем доступ к аккаунту (только владелец может менять slug)
    const account = await prisma.userAccount.findFirst({
      where: {
        id: accountId,
        OR: [
          { userId: user.id },
          { ownerId: user.id }
        ]
      },
      select: { 
        id: true,
        slug: true, 
        name: true,
        userId: true,
        ownerId: true
      }
    })

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found or access denied' },
        { status: 404 }
      )
    }

    // Проверяем, изменился ли slug
    if (account.slug === newSlug) {
      return NextResponse.json({ 
        success: true,
        message: 'Slug not changed (same value)',
        slug: newSlug 
      })
    }

    // Пытаемся изменить slug
    const result = await slugService.changeSlug(
      'account',
      accountId,
      newSlug,
      user.id, // changedBy = текущий пользователь
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
      source: 'account',
      module: 'settings',
      type: 'slug_changed',
      severity: 'info',
      message: `Account slug changed from "${result.oldSlug}" to "${result.newSlug}"`,
      actor: { type: 'user', id: user.id },
      subject: { type: 'account', id: accountId },
      key: accountId,
      payload: {
        accountId,
        accountName: account.name,
        oldSlug: result.oldSlug,
        newSlug: result.newSlug
      }
    }))

    return NextResponse.json({
      success: true,
      message: 'Slug changed successfully',
      oldSlug: result.oldSlug,
      newSlug: result.newSlug
    })
  } catch (error) {
    console.error('Error changing account slug:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

