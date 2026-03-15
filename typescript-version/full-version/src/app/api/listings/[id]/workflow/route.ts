/**
 * API: Listing Workflow
 *
 * GET  /api/listings/[id]/workflow - Получить состояние workflow
 * POST /api/listings/[id]/workflow - Выполнить переход
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { listingWorkflowService } from '@/services/workflows/ListingWorkflowService'
import { listingStateLabels, listingEventLabels } from '@/services/workflows/machines/ListingMachine'

/**
 * GET /api/listings/[id]/workflow
 *
 * Получить состояние workflow объявления
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id: listingId } = params
    const userRole = user.role?.code

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
  }
})

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
export const POST = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    const { id: listingId } = params
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

    const userRole = user.role?.code

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
  }
})
