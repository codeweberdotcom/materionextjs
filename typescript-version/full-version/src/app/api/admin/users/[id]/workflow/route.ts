/**
 * API: User Workflow
 *
 * GET  /api/admin/users/[id]/workflow - Получить состояние workflow
 * POST /api/admin/users/[id]/workflow - Выполнить переход
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { userWorkflowService } from '@/services/workflows/UserWorkflowService'
import { userStateLabels, userEventLabels } from '@/services/workflows/machines/UserMachine'

/**
 * GET /api/admin/users/[id]/workflow
 *
 * Получить состояние workflow пользователя
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id: userId } = params

    const workflowState = await userWorkflowService.getWorkflowState(userId, user.id)

    if (!workflowState) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    // Добавляем labels для фронтенда
    const response = {
      ...workflowState,
      stateLabel: userStateLabels[workflowState.currentState],
      availableEventsWithLabels: workflowState.availableEvents.map(event => ({
        event,
        label: userEventLabels[event] || event
      }))
    }

    return NextResponse.json(response)
  }
})

/**
 * POST /api/admin/users/[id]/workflow
 *
 * Выполнить переход состояния
 *
 * Body:
 * {
 *   event: string,      // 'SUSPEND' | 'RESTORE' | 'BLOCK' | 'UNBLOCK' | 'DELETE'
 *   reason?: string,    // Причина (обязательна для BLOCK/SUSPEND)
 *   metadata?: object   // Дополнительные данные
 * }
 */
export const POST = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    const { id: userId } = params
    const body = await request.json()
    const { event, reason, metadata } = body

    if (!event) {
      return NextResponse.json({ error: 'Не указано событие (event)' }, { status: 400 })
    }

    // Валидация события
    const validEvents = ['SUSPEND', 'RESTORE', 'BLOCK', 'UNBLOCK', 'DELETE']

    if (!validEvents.includes(event)) {
      return NextResponse.json(
        { error: `Недопустимое событие. Допустимые: ${validEvents.join(', ')}` },
        { status: 400 }
      )
    }

    // Для BLOCK и SUSPEND обязательна причина
    if ((event === 'BLOCK' || event === 'SUSPEND') && (!reason || reason.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Для блокировки/приостановки необходимо указать причину (reason)' },
        { status: 400 }
      )
    }

    // Выполнить переход
    const result = await userWorkflowService.transition({
      userId,
      event: event as 'SUSPEND' | 'RESTORE' | 'BLOCK' | 'UNBLOCK' | 'DELETE',
      actorId: user.id,
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
      fromStateLabel: userStateLabels[result.fromState],
      toState: result.toState,
      toStateLabel: userStateLabels[result.toState],
      event,
      eventLabel: userEventLabels[event],
      user: result.user
    })
  }
})
