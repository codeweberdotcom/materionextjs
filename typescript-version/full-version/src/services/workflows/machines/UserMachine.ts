/**
 * UserMachine - State Machine для пользователей
 *
 * Состояния:
 * - active: Активный пользователь (начальное)
 * - suspended: Временно приостановлен
 * - blocked: Заблокирован администратором
 * - deleted: Удалён (финальное)
 *
 * События:
 * - SUSPEND: Приостановить (требуется reason)
 * - RESTORE: Восстановить из suspended
 * - BLOCK: Заблокировать (требуется reason)
 * - UNBLOCK: Разблокировать
 * - DELETE: Удалить (только SUPERADMIN/ADMIN)
 *
 * Guards:
 * - Проверка иерархии ролей: actor.role.level < target.role.level
 * - Проверка прав: permissions.userManagement.[suspend|block|restore|unblock|delete]
 */

import { setup, assign } from 'xstate'

// Типы контекста
export interface UserContext {
  userId: string
  roleId: string
  roleLevel: number // Для проверки иерархии
  blockedBy?: string
  suspendedBy?: string
  reason?: string // Обязательна для BLOCK/SUSPEND
  blockedAt?: string
  suspendedAt?: string
  error?: string
}

// Типы событий
export type UserEvent =
  | { type: 'SUSPEND'; actorId: string; actorRoleLevel: number; reason: string; hasPermission: boolean }
  | { type: 'RESTORE'; actorId: string; actorRoleLevel: number; hasPermission: boolean }
  | { type: 'BLOCK'; actorId: string; actorRoleLevel: number; reason: string; hasPermission: boolean }
  | { type: 'UNBLOCK'; actorId: string; actorRoleLevel: number; hasPermission: boolean }
  | { type: 'DELETE'; actorId: string; actorRoleLevel: number; hasPermission: boolean }

// Типы входных данных для guards
export interface GuardInput {
  context: UserContext
  event: UserEvent
}

// Guards - условия переходов
export const userGuards = {
  /**
   * Проверяет, может ли актор приостановить пользователя
   * Условия:
   * 1. Иерархия: actor.role.level < target.role.level
   * 2. Право: userManagement.suspend
   * 3. Причина обязательна
   */
  canSuspend: ({ context, event }: GuardInput): boolean => {
    if (event.type !== 'SUSPEND') return false

    // Проверка иерархии ролей
    const hasHierarchy = event.actorRoleLevel < context.roleLevel

    // Проверка права
    const hasPermission = event.hasPermission

    // Проверка причины
    const hasReason = !!event.reason && event.reason.trim().length > 0

    return hasHierarchy && hasPermission && hasReason
  },

  /**
   * Проверяет, может ли актор восстановить пользователя
   * Условия:
   * 1. Иерархия: actor.role.level < target.role.level
   * 2. Право: userManagement.restore
   */
  canRestore: ({ context, event }: GuardInput): boolean => {
    if (event.type !== 'RESTORE') return false

    // Проверка иерархии ролей
    const hasHierarchy = event.actorRoleLevel < context.roleLevel

    // Проверка права
    const hasPermission = event.hasPermission

    return hasHierarchy && hasPermission
  },

  /**
   * Проверяет, может ли актор заблокировать пользователя
   * Условия:
   * 1. Иерархия: actor.role.level < target.role.level
   * 2. Право: userManagement.block
   * 3. Причина обязательна
   */
  canBlock: ({ context, event }: GuardInput): boolean => {
    if (event.type !== 'BLOCK') return false

    // Проверка иерархии ролей
    const hasHierarchy = event.actorRoleLevel < context.roleLevel

    // Проверка права
    const hasPermission = event.hasPermission

    // Проверка причины
    const hasReason = !!event.reason && event.reason.trim().length > 0

    return hasHierarchy && hasPermission && hasReason
  },

  /**
   * Проверяет, может ли актор разблокировать пользователя
   * Условия:
   * 1. Иерархия: actor.role.level < target.role.level
   * 2. Право: userManagement.unblock
   */
  canUnblock: ({ context, event }: GuardInput): boolean => {
    if (event.type !== 'UNBLOCK') return false

    // Проверка иерархии ролей
    const hasHierarchy = event.actorRoleLevel < context.roleLevel

    // Проверка права
    const hasPermission = event.hasPermission

    return hasHierarchy && hasPermission
  },

  /**
   * Проверяет, может ли актор удалить пользователя
   * Условия:
   * 1. Право: userManagement.delete (обычно только SUPERADMIN/ADMIN)
   */
  canDelete: ({ event }: GuardInput): boolean => {
    if (event.type !== 'DELETE') return false

    // Проверка права (иерархия не нужна, т.к. удаление - критическая операция)
    return event.hasPermission
  }
}

// Actions - действия при переходах
export const userActions = {
  /**
   * Сохранить данные приостановки
   */
  setSuspendedData: assign(({ event, context }) => {
    if (event.type !== 'SUSPEND') return {}

    return {
      suspendedBy: event.actorId,
      suspendedAt: new Date().toISOString(),
      reason: event.reason
    }
  }),

  /**
   * Очистить данные приостановки при восстановлении
   */
  clearSuspendedData: assign({
    suspendedBy: undefined,
    suspendedAt: undefined,
    reason: undefined
  }),

  /**
   * Сохранить данные блокировки
   */
  setBlockedData: assign(({ event, context }) => {
    if (event.type !== 'BLOCK') return {}

    return {
      blockedBy: event.actorId,
      blockedAt: new Date().toISOString(),
      reason: event.reason,
      // Очищаем данные приостановки при блокировке
      suspendedBy: undefined,
      suspendedAt: undefined
    }
  }),

  /**
   * Очистить данные блокировки при разблокировке
   */
  clearBlockedData: assign({
    blockedBy: undefined,
    blockedAt: undefined,
    reason: undefined
  }),

  /**
   * Логирование перехода (для отладки)
   */
    logTransition: ({ context, event }: any) => {
    console.log(`[UserMachine] Transition: ${event.type}`, {
      userId: context.userId,
      actorId: 'actorId' in event ? event.actorId : undefined
    })
  }
}

/**
 * User State Machine
 */
export const userMachine = setup({
  types: {
    context: {} as UserContext,
    events: {} as UserEvent
  },
  guards: userGuards,
  // @ts-expect-error - XState type mismatch
  actions: userActions
}).createMachine({
  id: 'user',
  initial: 'active',
  // @ts-expect-error - XState type mismatch
  context: ({ input }: { input?: Partial<UserContext> }) => ({
    userId: input?.userId || '',
    roleId: input?.roleId || '',
    roleLevel: input?.roleLevel ?? 100,
    blockedBy: input?.blockedBy,
    suspendedBy: input?.suspendedBy,
    reason: input?.reason,
    blockedAt: input?.blockedAt,
    suspendedAt: input?.suspendedAt
  }),
  states: {
    /**
     * Активный пользователь - начальное состояние
     */
    active: {
      on: {
        SUSPEND: {
          target: 'suspended',
          guard: 'canSuspend',
          actions: ['logTransition', 'setSuspendedData']
        },
        BLOCK: {
          target: 'blocked',
          guard: 'canBlock',
          actions: ['logTransition', 'setBlockedData']
        },
        DELETE: {
          target: 'deleted',
          guard: 'canDelete',
          actions: ['logTransition']
        }
      }
    },

    /**
     * Временно приостановлен
     */
    suspended: {
      on: {
        RESTORE: {
          target: 'active',
          guard: 'canRestore',
          actions: ['logTransition', 'clearSuspendedData']
        },
        BLOCK: {
          target: 'blocked',
          guard: 'canBlock',
          actions: ['logTransition', 'setBlockedData']
        },
        DELETE: {
          target: 'deleted',
          guard: 'canDelete',
          actions: ['logTransition']
        }
      }
    },

    /**
     * Заблокирован администратором
     */
    blocked: {
      on: {
        UNBLOCK: {
          target: 'active',
          guard: 'canUnblock',
          actions: ['logTransition', 'clearBlockedData']
        },
        DELETE: {
          target: 'deleted',
          guard: 'canDelete',
          actions: ['logTransition']
        }
      }
    },

    /**
     * Удалён (финальное состояние)
     */
    deleted: {
      type: 'final'
    }
  }
})

// Экспорт типов состояний
export type UserState = 'active' | 'suspended' | 'blocked' | 'deleted'

// Маппинг состояний на русский
export const userStateLabels: Record<UserState, string> = {
  active: 'Активен',
  suspended: 'Приостановлен',
  blocked: 'Заблокирован',
  deleted: 'Удалён'
}

// Маппинг событий на русский
export const userEventLabels: Record<string, string> = {
  SUSPEND: 'Приостановить',
  RESTORE: 'Восстановить',
  BLOCK: 'Заблокировать',
  UNBLOCK: 'Разблокировать',
  DELETE: 'Удалить'
}

// Цвета для состояний (MUI)
export const userStateColors: Record<UserState, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  active: 'success',
  suspended: 'warning',
  blocked: 'error',
  deleted: 'default'
}



