/**
 * API: User Workflow
 *
 * GET  /api/admin/users/[id]/workflow - Получить состояние workflow
 * POST /api/admin/users/[id]/workflow - Выполнить переход
 */

import { NextRequest, NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { userWorkflowService } from '@/services/workflows/UserWorkflowService'
import { userStateLabels, userEventLabels } from '@/services/workflows/machines/UserMachine'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/users/[id]/workflow
 *
 * Получить состояние workflow пользователя
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }

    const { id: userId } = await params

    const workflowState = await userWorkflowService.getWorkflowState(userId, session.user.id)

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
  } catch (error) {
    console.error('[API] GET /api/admin/users/[id]/workflow error:', error)

    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

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
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })
    }

    const { id: userId } = await params
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
      actorId: session.user.id,
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
  } catch (error) {
    console.error('[API] POST /api/admin/users/[id]/workflow error:', error)

    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}


