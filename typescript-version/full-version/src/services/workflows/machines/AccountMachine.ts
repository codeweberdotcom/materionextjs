/**
 * AccountMachine - State Machine для аккаунтов пользователей
 *
 * Состояния:
 * - active: Активный аккаунт (начальное)
 * - suspended: Временно приостановлен
 * - archived: Архивирован
 *
 * События:
 * - SUSPEND: Приостановить аккаунт
 * - RESTORE: Восстановить из suspended
 * - ARCHIVE: Архивировать аккаунт
 * - ACTIVATE: Активировать из archived
 *
 * Guards:
 * - Проверка прав доступа
 * - Проверка тарифного плана
 */

import { setup, assign } from 'xstate'

// Типы контекста
export interface AccountContext {
  accountId: string
  userId: string
  ownerId: string
  accountType: string // 'LISTING', 'COMPANY', 'NETWORK'
  tariffPlanId: string
  suspendedBy?: string
  archivedBy?: string
  reason?: string
  suspendedAt?: string
  archivedAt?: string
  error?: string
}

// Типы событий
export type AccountEvent =
  | { type: 'SUSPEND'; actorId: string; reason?: string; hasPermission: boolean }
  | { type: 'RESTORE'; actorId: string; hasPermission: boolean }
  | { type: 'ARCHIVE'; actorId: string; reason?: string; hasPermission: boolean }
  | { type: 'ACTIVATE'; actorId: string; hasPermission: boolean }

// Типы входных данных для guards
export interface GuardInput {
  context: AccountContext
  event: AccountEvent
}

// Guards - условия переходов
export const accountGuards = {
  /**
   * Проверяет, может ли актор приостановить аккаунт
   */
  canSuspend: ({ context, event }: GuardInput): boolean => {
    if (event.type !== 'SUSPEND') return false

    // Проверка прав
    const hasPermission = event.hasPermission

    // Только владелец может приостановить
    const isOwner = context.ownerId === ('actorId' in event ? event.actorId : '') ||
                    context.userId === ('actorId' in event ? event.actorId : '')

    return hasPermission && isOwner
  },

  /**
   * Проверяет, может ли актор восстановить аккаунт
   */
  canRestore: ({ context, event }: GuardInput): boolean => {
    if (event.type !== 'RESTORE') return false

    const hasPermission = event.hasPermission
    const isOwner = context.ownerId === ('actorId' in event ? event.actorId : '') ||
                    context.userId === ('actorId' in event ? event.actorId : '')

    return hasPermission && isOwner
  },

  /**
   * Проверяет, может ли актор архивировать аккаунт
   */
  canArchive: ({ context, event }: GuardInput): boolean => {
    if (event.type !== 'ARCHIVE') return false

    const hasPermission = event.hasPermission
    const isOwner = context.ownerId === ('actorId' in event ? event.actorId : '') ||
                    context.userId === ('actorId' in event ? event.actorId : '')

    return hasPermission && isOwner
  },

  /**
   * Проверяет, может ли актор активировать аккаунт
   */
  canActivate: ({ context, event }: GuardInput): boolean => {
    if (event.type !== 'ACTIVATE') return false

    const hasPermission = event.hasPermission
    const isOwner = context.ownerId === ('actorId' in event ? event.actorId : '') ||
                    context.userId === ('actorId' in event ? event.actorId : '')

    return hasPermission && isOwner
  }
}

// Actions - действия при переходах
export const accountActions = {
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
   * Сохранить данные архивации
   */
  setArchivedData: assign(({ event, context }) => {
    if (event.type !== 'ARCHIVE') return {}

    return {
      archivedBy: event.actorId,
      archivedAt: new Date().toISOString(),
      reason: event.reason
    }
  }),

  /**
   * Очистить данные архивации при активации
   */
  clearArchivedData: assign({
    archivedBy: undefined,
    archivedAt: undefined,
    reason: undefined
  }),

  /**
   * Логирование перехода (для отладки)
   */
    logTransition: ({ context, event }: any) => {
    console.log(`[AccountMachine] Transition: ${event.type}`, {
      accountId: context.accountId,
      actorId: 'actorId' in event ? event.actorId : undefined
    })
  }
}

/**
 * Account State Machine
 */
export const accountMachine = setup({
  types: {
    context: {} as AccountContext,
    events: {} as AccountEvent
  },
  guards: accountGuards,
  // @ts-expect-error - XState type mismatch
  actions: accountActions
}).createMachine({
  id: 'account',
  initial: 'active',
  // @ts-expect-error - XState type mismatch
  context: ({ input }: { input?: Partial<AccountContext> }) => ({
    accountId: input?.accountId || '',
    userId: input?.userId || '',
    ownerId: input?.ownerId || '',
    accountType: input?.accountType || 'LISTING',
    tariffPlanId: input?.tariffPlanId || '',
    suspendedBy: input?.suspendedBy,
    archivedBy: input?.archivedBy,
    reason: input?.reason,
    suspendedAt: input?.suspendedAt,
    archivedAt: input?.archivedAt
  }),
  states: {
    /**
     * Активный аккаунт - начальное состояние
     */
    active: {
      on: {
        SUSPEND: {
          target: 'suspended',
          guard: 'canSuspend',
          actions: ['logTransition', 'setSuspendedData']
        },
        ARCHIVE: {
          target: 'archived',
          guard: 'canArchive',
          actions: ['logTransition', 'setArchivedData']
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
        ARCHIVE: {
          target: 'archived',
          guard: 'canArchive',
          actions: ['logTransition', 'setArchivedData']
        }
      }
    },

    /**
     * Архивирован
     */
    archived: {
      on: {
        ACTIVATE: {
          target: 'active',
          guard: 'canActivate',
          actions: ['logTransition', 'clearArchivedData']
        }
      }
    }
  }
})

// Экспорт типов состояний
export type AccountState = 'active' | 'suspended' | 'archived'

// Маппинг состояний на русский
export const accountStateLabels: Record<AccountState, string> = {
  active: 'Активен',
  suspended: 'Приостановлен',
  archived: 'Архивирован'
}

// Маппинг событий на русский
export const accountEventLabels: Record<string, string> = {
  SUSPEND: 'Приостановить',
  RESTORE: 'Восстановить',
  ARCHIVE: 'Архивировать',
  ACTIVATE: 'Активировать'
}

// Цвета для состояний (MUI)
export const accountStateColors: Record<AccountState, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  active: 'success',
  suspended: 'warning',
  archived: 'default'
}



