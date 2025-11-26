/**
 * ListingMachine - State Machine для объявлений
 *
 * Состояния:
 * - draft: Черновик (начальное)
 * - pending: На модерации
 * - active: Опубликовано
 * - rejected: Отклонено
 * - sold: Продано
 * - archived: В архиве
 * - deleted: Удалено (финальное)
 *
 * События:
 * - SUBMIT: Отправить на модерацию
 * - APPROVE: Одобрить (модератор)
 * - REJECT: Отклонить (модератор)
 * - SELL: Пометить как продано
 * - ARCHIVE: Архивировать
 * - DELETE: Удалить
 * - RESTORE: Восстановить
 * - EDIT: Редактировать (возврат в draft)
 */

import { setup, assign } from 'xstate'

// Типы контекста
export interface ListingContext {
  listingId: string
  ownerId: string
  moderatorId?: string
  rejectionReason?: string
  publishedAt?: string
  soldAt?: string
  archivedAt?: string
  error?: string
}

// Типы событий
export type ListingEvent =
  | { type: 'SUBMIT' }
  | { type: 'APPROVE'; moderatorId: string }
  | { type: 'REJECT'; moderatorId: string; reason: string }
  | { type: 'SELL' }
  | { type: 'ARCHIVE' }
  | { type: 'DELETE' }
  | { type: 'RESTORE' }
  | { type: 'EDIT' }

// Типы входных данных для guards
export interface GuardInput {
  context: ListingContext
  event: ListingEvent
}

// Guards - условия переходов
export const listingGuards = {
  /**
   * Проверяет, может ли пользователь отправить на модерацию
   * Условие: объявление должно иметь владельца
   */
  canSubmit: ({ context }: GuardInput): boolean => {
    return !!context.ownerId && !!context.listingId
  },

  /**
   * Проверяет, может ли модератор одобрить объявление
   * Условие: должен быть указан moderatorId в событии
   */
  canApprove: ({ event }: GuardInput): boolean => {
    if (event.type !== 'APPROVE') return false

    return !!event.moderatorId
  },

  /**
   * Проверяет, может ли модератор отклонить объявление
   * Условие: должен быть указан moderatorId и причина
   */
  canReject: ({ event }: GuardInput): boolean => {
    if (event.type !== 'REJECT') return false

    return !!event.moderatorId && !!event.reason
  },

  /**
   * Проверяет, может ли владелец архивировать
   */
  canArchive: ({ context }: GuardInput): boolean => {
    return !!context.ownerId
  },

  /**
   * Проверяет, может ли владелец удалить
   */
  canDelete: ({ context }: GuardInput): boolean => {
    return !!context.ownerId
  },

  /**
   * Проверяет, может ли владелец восстановить
   */
  canRestore: ({ context }: GuardInput): boolean => {
    return !!context.ownerId
  }
}

// Actions - действия при переходах
export const listingActions = {
  /**
   * Очистить данные модерации при возврате в draft
   */
  clearModerationData: assign({
    moderatorId: undefined,
    rejectionReason: undefined
  }),

  /**
   * Сохранить данные одобрения
   */
  setApprovalData: assign(({ event }) => {
    if (event.type !== 'APPROVE') return {}

    return {
      moderatorId: event.moderatorId,
      publishedAt: new Date().toISOString(),
      rejectionReason: undefined
    }
  }),

  /**
   * Сохранить данные отклонения
   */
  setRejectionData: assign(({ event }) => {
    if (event.type !== 'REJECT') return {}

    return {
      moderatorId: event.moderatorId,
      rejectionReason: event.reason,
      publishedAt: undefined
    }
  }),

  /**
   * Установить дату продажи
   */
  setSoldDate: assign({
    soldAt: () => new Date().toISOString()
  }),

  /**
   * Установить дату архивации
   */
  setArchivedDate: assign({
    archivedAt: () => new Date().toISOString()
  }),

  /**
   * Очистить дату архивации при восстановлении
   */
  clearArchivedDate: assign({
    archivedAt: undefined
  }),

  /**
   * Логирование перехода (для отладки)
   */
  logTransition: ({ context, event }: { context: ListingContext; event: ListingEvent }) => {
    console.log(`[ListingMachine] Transition: ${event.type}`, {
      listingId: context.listingId,
      ownerId: context.ownerId
    })
  }
}

/**
 * Listing State Machine
 */
export const listingMachine = setup({
  types: {
    context: {} as ListingContext,
    events: {} as ListingEvent
  },
  guards: listingGuards,
  actions: listingActions
}).createMachine({
  id: 'listing',
  initial: 'draft',
  context: ({ input }: { input?: Partial<ListingContext> }) => ({
    listingId: input?.listingId || '',
    ownerId: input?.ownerId || '',
    moderatorId: input?.moderatorId,
    rejectionReason: input?.rejectionReason,
    publishedAt: input?.publishedAt,
    soldAt: input?.soldAt,
    archivedAt: input?.archivedAt
  }),
  states: {
    /**
     * Черновик - начальное состояние
     */
    draft: {
      on: {
        SUBMIT: {
          target: 'pending',
          guard: 'canSubmit',
          actions: ['logTransition', 'clearModerationData']
        }
      }
    },

    /**
     * На модерации
     */
    pending: {
      on: {
        APPROVE: {
          target: 'active',
          guard: 'canApprove',
          actions: ['logTransition', 'setApprovalData']
        },
        REJECT: {
          target: 'rejected',
          guard: 'canReject',
          actions: ['logTransition', 'setRejectionData']
        },
        // Владелец может отменить отправку
        EDIT: {
          target: 'draft',
          actions: ['logTransition', 'clearModerationData']
        }
      }
    },

    /**
     * Опубликовано (активно)
     */
    active: {
      on: {
        SELL: {
          target: 'sold',
          actions: ['logTransition', 'setSoldDate']
        },
        ARCHIVE: {
          target: 'archived',
          guard: 'canArchive',
          actions: ['logTransition', 'setArchivedDate']
        },
        DELETE: {
          target: 'deleted',
          guard: 'canDelete',
          actions: ['logTransition']
        },
        // Редактирование возвращает на модерацию
        EDIT: {
          target: 'pending',
          actions: ['logTransition', 'clearModerationData']
        }
      }
    },

    /**
     * Отклонено модератором
     */
    rejected: {
      on: {
        // Владелец может исправить и отправить снова
        EDIT: {
          target: 'draft',
          actions: ['logTransition', 'clearModerationData']
        },
        DELETE: {
          target: 'deleted',
          guard: 'canDelete',
          actions: ['logTransition']
        }
      }
    },

    /**
     * Продано
     */
    sold: {
      on: {
        // Можно архивировать проданное
        ARCHIVE: {
          target: 'archived',
          actions: ['logTransition', 'setArchivedDate']
        },
        DELETE: {
          target: 'deleted',
          guard: 'canDelete',
          actions: ['logTransition']
        }
      }
    },

    /**
     * В архиве
     */
    archived: {
      on: {
        // Восстановить из архива
        RESTORE: {
          target: 'active',
          guard: 'canRestore',
          actions: ['logTransition', 'clearArchivedDate']
        },
        DELETE: {
          target: 'deleted',
          guard: 'canDelete',
          actions: ['logTransition']
        }
      }
    },

    /**
     * Удалено (финальное состояние)
     */
    deleted: {
      type: 'final'
    }
  }
})

// Экспорт типов состояний
export type ListingState = 'draft' | 'pending' | 'active' | 'rejected' | 'sold' | 'archived' | 'deleted'

// Маппинг состояний на русский
export const listingStateLabels: Record<ListingState, string> = {
  draft: 'Черновик',
  pending: 'На модерации',
  active: 'Опубликовано',
  rejected: 'Отклонено',
  sold: 'Продано',
  archived: 'В архиве',
  deleted: 'Удалено'
}

// Маппинг событий на русский
export const listingEventLabels: Record<string, string> = {
  SUBMIT: 'Отправить на модерацию',
  APPROVE: 'Одобрить',
  REJECT: 'Отклонить',
  SELL: 'Пометить как продано',
  ARCHIVE: 'Архивировать',
  DELETE: 'Удалить',
  RESTORE: 'Восстановить',
  EDIT: 'Редактировать'
}

// Цвета для состояний (MUI)
export const listingStateColors: Record<ListingState, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  draft: 'default',
  pending: 'warning',
  active: 'success',
  rejected: 'error',
  sold: 'info',
  archived: 'secondary',
  deleted: 'default'
}



