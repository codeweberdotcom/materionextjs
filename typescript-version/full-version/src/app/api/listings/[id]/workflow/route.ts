/**
 * API: Listing Workflow
 *
 * GET  /api/listings/[id]/workflow - Получить состояние workflow
 * POST /api/listings/[id]/workflow - Выполнить переход
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { listingWorkflowService } from '@/services/workflows/ListingWorkflowService'
import { listingStateLabels, listingEventLabels } from '@/services/workflows/machines/ListingMachine'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/listings/[id]/workflow
 *
 * Получить состояние workflow объявления
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.id) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }

    const { id: listingId } = await params
    const userRole = (session.user as { role?: { code?: string } }).role?.code

    const workflowState = await listingWorkflowService.getWorkflowState(
      listingId,
      user.id,
      userRole
    )

    if (!workflowState) {
      return NextResponse.json({ error: 'Объявление не найдено' }, { status: 404 })
    }

    // Добавляем labels для фронтенда
    const response = {
      ...workflowState,
      stateLabel: listingStateLabels[workflowState.currentState],
      availableEventsWithLabels: workflowState.availableEvents.map(event => ({
        event,
        label: listingEventLabels[event] || event
      }))
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API] GET /api/listings/[id]/workflow error:', error)

    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/listings/[id]/workflow
 *
 * Выполнить переход состояния
 *
 * Body:
 * {
 *   event: string,      // 'SUBMIT' | 'APPROVE' | 'REJECT' | 'SELL' | 'ARCHIVE' | 'DELETE' | 'RESTORE' | 'EDIT'
 *   reason?: string,    // Причина (для REJECT)
 *   metadata?: object   // Дополнительные данные
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.id) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }

    const { id: listingId } = await params
    const body = await request.json()
    const { event, reason, metadata } = body

    if (!event) {
      return NextResponse.json({ error: 'Не указано событие (event)' }, { status: 400 })
    }

    // Валидация события
    const validEvents = ['SUBMIT', 'APPROVE', 'REJECT', 'SELL', 'ARCHIVE', 'DELETE', 'RESTORE', 'EDIT']

    if (!validEvents.includes(event)) {
      return NextResponse.json(
        { error: `Недопустимое событие. Допустимые: ${validEvents.join(', ')}` },
        { status: 400 }
      )
    }

    // Для REJECT обязательна причина
    if (event === 'REJECT' && !reason) {
      return NextResponse.json(
        { error: 'Для отклонения необходимо указать причину (reason)' },
        { status: 400 }
      )
    }

    const userRole = (session.user as { role?: { code?: string } }).role?.code

    // Проверка прав на модерацию
    const moderatorEvents = ['APPROVE', 'REJECT']

    if (moderatorEvents.includes(event)) {
      const allowedRoles = ['SUPERADMIN', 'ADMIN', 'MODERATOR']

      if (!userRole || !allowedRoles.includes(userRole)) {
        return NextResponse.json(
          { error: 'Недостаточно прав для модерации' },
          { status: 403 }
        )
      }
    }

    // Выполнить переход
    const result = await listingWorkflowService.transition({
      listingId,
      event,
      actorId: user.id,
      actorRole: userRole,
      reason,
      metadata
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          fromState: result.fromState,
          toState: result.toState
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      fromState: result.fromState,
      fromStateLabel: listingStateLabels[result.fromState],
      toState: result.toState,
      toStateLabel: listingStateLabels[result.toState],
      event,
      eventLabel: listingEventLabels[event],
      listing: result.listing
    })
  } catch (error) {
    console.error('[API] POST /api/listings/[id]/workflow error:', error)

    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}



