/**
 * UserWorkflowService - Сервис управления workflow пользователей
 *
 * Интегрирует:
 * - XState машину состояний
 * - Проверку иерархии ролей и прав
 * - Отзыв сессий при блокировке/удалении
 * - Уведомления пользователю
 * - События системы (безопасность)
 * - Обновление БД
 */

import { createActor } from 'xstate'

import prisma from '@/libs/prisma'
import { eventService } from '@/services/events/EventService'
import { checkPermission, type UserWithRoleLike } from '@/utils/permissions/permissions'

import { userMachine, type UserContext, type UserState, userStateLabels } from './machines/UserMachine'

// Типы
export interface UserTransitionInput {
  userId: string
  event: 'SUSPEND' | 'RESTORE' | 'BLOCK' | 'UNBLOCK' | 'DELETE'
  actorId: string // Кто инициирует
  reason?: string // Причина (обязательна для BLOCK/SUSPEND)
  metadata?: Record<string, unknown>
}

export interface UserTransitionResult {
  success: boolean
  fromState: UserState
  toState: UserState
  event: string
  error?: string
  user?: {
    id: string
    email: string | null
    name: string | null
    status: string
  }
}

export interface UserWorkflowState {
  userId: string
  currentState: UserState
  context: UserContext
  availableEvents: string[]
  canSuspend: boolean
  canBlock: boolean
  canRestore: boolean
  canUnblock: boolean
  canDelete: boolean
}

class UserWorkflowService {
  private static instance: UserWorkflowService

  static getInstance(): UserWorkflowService {
    if (!UserWorkflowService.instance) {
      UserWorkflowService.instance = new UserWorkflowService()
    }

    return UserWorkflowService.instance
  }

  /**
   * Выполнить переход состояния пользователя
   */
  async transition(input: UserTransitionInput): Promise<UserTransitionResult> {
    const { userId, event, actorId, reason, metadata } = input

    try {
      // Получить пользователя и его роль
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true }
      })

      if (!targetUser) {
        return {
          success: false,
          fromState: 'active',
          toState: 'active',
          event,
          error: 'Пользователь не найден'
        }
      }

      // Получить актора и его роль
      const actor = await prisma.user.findUnique({
        where: { id: actorId },
        include: { role: true }
      })

      if (!actor || !actor.role) {
        return {
          success: false,
          fromState: targetUser.status as UserState,
          toState: targetUser.status as UserState,
          event,
          error: 'Актор не найден или не имеет роли'
        }
      }

      // Проверка иерархии ролей
      if (actor.role.level >= targetUser.role.level) {
        return {
          success: false,
          fromState: targetUser.status as UserState,
          toState: targetUser.status as UserState,
          event,
          error: 'Недостаточно прав: роль актора должна быть выше роли целевого пользователя'
        }
      }

      // Проверка прав доступа
      const permissionMap: Record<string, string> = {
        SUSPEND: 'suspend',
        RESTORE: 'restore',
        BLOCK: 'block',
        UNBLOCK: 'unblock',
        DELETE: 'delete'
      }

      const permissionAction = permissionMap[event]
      if (!permissionAction) {
        return {
          success: false,
          fromState: targetUser.status as UserState,
          toState: targetUser.status as UserState,
          event,
          error: `Неизвестное событие: ${event}`
        }
      }

      const hasPermission = checkPermission(actor as UserWithRoleLike, 'userManagement', permissionAction)
      if (!hasPermission) {
        return {
          success: false,
          fromState: targetUser.status as UserState,
          toState: targetUser.status as UserState,
          event,
          error: `Нет прав для выполнения действия: userManagement.${permissionAction}`
        }
      }

      // Проверка обязательной причины для BLOCK/SUSPEND
      if ((event === 'BLOCK' || event === 'SUSPEND') && (!reason || reason.trim().length === 0)) {
        return {
          success: false,
          fromState: targetUser.status as UserState,
          toState: targetUser.status as UserState,
          event,
          error: 'Причина обязательна для блокировки/приостановки'
        }
      }

      const fromState = targetUser.status as UserState

      // Создать контекст машины
      const context: UserContext = {
        userId: targetUser.id,
        roleId: targetUser.roleId,
        roleLevel: targetUser.role.level,
        blockedBy: undefined, // Будет установлено при блокировке
        suspendedBy: undefined, // Будет установлено при приостановке
        reason: reason || undefined,
        blockedAt: undefined,
        suspendedAt: undefined
      }

      // Создать actor
      const actorMachine = createActor(userMachine, {
        input: context
      })

      actorMachine.start()

      // Проверить возможность перехода
      const snapshot = actorMachine.getSnapshot()

      // Формируем событие с данными
      const eventPayload = this.buildEventPayload(event, actorId, actor.role.level, hasPermission, reason)

      // Проверяем можно ли выполнить переход
      if (!snapshot.can(eventPayload)) {
        actorMachine.stop()

        return {
          success: false,
          fromState,
          toState: fromState,
          event,
          error: `Переход '${event}' невозможен из состояния '${fromState}'`
        }
      }

      // Выполняем переход
      actorMachine.send(eventPayload)

      const newSnapshot = actorMachine.getSnapshot()
      const toState = (typeof newSnapshot.value === 'string' ? newSnapshot.value : 'active') as UserState

      actorMachine.stop()

      // Обновляем БД
      const updateData = this.buildUpdateData(event, toState, actorId, reason)

      await prisma.user.update({
        where: { id: userId },
        data: updateData
      })

      // Записываем в workflow_transitions
      const workflowInstance = await this.ensureWorkflowInstance(userId, fromState)

      await prisma.workflowTransition.create({
        data: {
          instanceId: workflowInstance.id,
          fromState,
          toState,
          event,
          actorId,
          actorType: 'admin',
          metadata: metadata ? JSON.stringify(metadata) : null
        }
      })

      // Обновляем состояние в workflow_instances
      await prisma.workflowInstance.update({
        where: { id: workflowInstance.id },
        data: {
          state: toState,
          version: { increment: 1 }
        }
      })

      // Side effects
      await this.handleSideEffects(targetUser, fromState, toState, event, actorId, reason)

      return {
        success: true,
        fromState,
        toState,
        event,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          status: toState
        }
      }
    } catch (error) {
      console.error('[UserWorkflowService] Ошибка перехода:', error)

      return {
        success: false,
        fromState: 'active',
        toState: 'active',
        event,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      }
    }
  }

  /**
   * Получить состояние workflow пользователя
   */
  async getWorkflowState(userId: string, actorId?: string): Promise<UserWorkflowState | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    })

    if (!user) {
      return null
    }

    const currentState = user.status as UserState

    // Если есть актор, проверяем доступные действия
    let canSuspend = false
    let canBlock = false
    let canRestore = false
    let canUnblock = false
    let canDelete = false

    if (actorId) {
      const actor = await prisma.user.findUnique({
        where: { id: actorId },
        include: { role: true }
      })

      if (actor && actor.role) {
        const hasHierarchy = actor.role.level < user.role.level

        canSuspend = hasHierarchy && checkPermission(actor as UserWithRoleLike, 'userManagement', 'suspend')
        canBlock = hasHierarchy && checkPermission(actor as UserWithRoleLike, 'userManagement', 'block')
        canRestore = hasHierarchy && checkPermission(actor as UserWithRoleLike, 'userManagement', 'restore')
        canUnblock = hasHierarchy && checkPermission(actor as UserWithRoleLike, 'userManagement', 'unblock')
        canDelete = checkPermission(actor as UserWithRoleLike, 'userManagement', 'delete')
      }
    }

    // Определяем доступные события
    const availableEvents: string[] = []
    if (canSuspend && currentState === 'active') availableEvents.push('SUSPEND')
    if (canBlock && ['active', 'suspended'].includes(currentState)) availableEvents.push('BLOCK')
    if (canRestore && currentState === 'suspended') availableEvents.push('RESTORE')
    if (canUnblock && currentState === 'blocked') availableEvents.push('UNBLOCK')
    if (canDelete && ['active', 'suspended', 'blocked'].includes(currentState)) availableEvents.push('DELETE')

    return {
      userId: user.id,
      currentState,
      context: {
        userId: user.id,
        roleId: user.roleId,
        roleLevel: user.role.level
      },
      availableEvents,
      canSuspend,
      canBlock,
      canRestore,
      canUnblock,
      canDelete
    }
  }

  /**
   * Получить историю переходов пользователя
   */
  async getTransitionHistory(userId: string, limit: number = 50) {
    const instance = await prisma.workflowInstance.findUnique({
      where: { type_entityId: { type: 'user', entityId: userId } }
    })

    if (!instance) {
      return []
    }

    return prisma.workflowTransition.findMany({
      where: { instanceId: instance.id },
      orderBy: { createdAt: 'desc' },
      take: limit
    })
  }

  /**
   * Построить payload события
   */
  private buildEventPayload(
    event: string,
    actorId: string,
    actorRoleLevel: number,
    hasPermission: boolean,
    reason?: string
  ) {
    switch (event) {
      case 'SUSPEND':
        return { type: 'SUSPEND', actorId, actorRoleLevel, hasPermission, reason: reason || '' }
      case 'RESTORE':
        return { type: 'RESTORE', actorId, actorRoleLevel, hasPermission }
      case 'BLOCK':
        return { type: 'BLOCK', actorId, actorRoleLevel, hasPermission, reason: reason || '' }
      case 'UNBLOCK':
        return { type: 'UNBLOCK', actorId, actorRoleLevel, hasPermission }
      case 'DELETE':
        return { type: 'DELETE', actorId, actorRoleLevel, hasPermission }
      default:
        throw new Error(`Неизвестное событие: ${event}`)
    }
  }

  /**
   * Построить данные для обновления БД
   */
  private buildUpdateData(event: string, toState: UserState, actorId: string, reason?: string) {
    const now = new Date()

    switch (toState) {
      case 'suspended':
        return {
          status: 'suspended',
          // Можно добавить поля suspendedBy, suspendedAt если нужно
        }
      case 'blocked':
        return {
          status: 'blocked',
          // Можно добавить поля blockedBy, blockedAt если нужно
        }
      case 'active':
        return {
          status: 'active'
        }
      case 'deleted':
        return {
          status: 'deleted'
        }
      default:
        return { status: toState }
    }
  }

  /**
   * Обеспечить наличие workflow instance
   */
  private async ensureWorkflowInstance(userId: string, initialState: UserState) {
    const existing = await prisma.workflowInstance.findUnique({
      where: { type_entityId: { type: 'user', entityId: userId } }
    })

    if (existing) {
      return existing
    }

    return prisma.workflowInstance.create({
      data: {
        type: 'user',
        entityId: userId,
        state: initialState,
        context: JSON.stringify({})
      }
    })
  }

  /**
   * Обработка side effects (уведомления, события, отзыв сессий)
   */
  private async handleSideEffects(
    user: { id: string; email: string | null; name: string | null },
    fromState: UserState,
    toState: UserState,
    event: string,
    actorId: string,
    reason?: string
  ) {
    // Отзыв сессий при блокировке/удалении
    if (toState === 'blocked' || toState === 'deleted') {
      await prisma.session.deleteMany({
        where: { userId: user.id }
      })

      console.log(`[UserWorkflowService] Отозваны все сессии пользователя ${user.id}`)
    }

    // Логирование события безопасности
    const severity = ['blocked', 'deleted'].includes(toState) ? 'error' : 'warning'

    await eventService.create({
      source: 'workflow',
      module: 'user',
      type: `user.${event.toLowerCase()}`,
      severity,
      actorType: 'admin',
      actorId,
      subjectType: 'user',
      subjectId: user.id,
      message: `Пользователь ${user.email || user.id} переведён из состояния '${userStateLabels[fromState]}' в '${userStateLabels[toState]}'`,
      payload: {
        fromState,
        toState,
        event,
        reason
      }
    })

    // TODO: Уведомление пользователю через NotificationService
    // await notificationService.send({
    //   userId: user.id,
    //   title: `Ваш аккаунт ${userStateLabels[toState]}`,
    //   message: reason || `Ваш аккаунт был переведён в состояние '${userStateLabels[toState]}'`
    // })
  }
}

export const userWorkflowService = UserWorkflowService.getInstance()


