/**
 * AccountWorkflowService - Сервис управления workflow аккаунтов
 *
 * Интегрирует:
 * - XState машину состояний
 * - Проверку прав доступа
 * - Уведомления владельцу
 * - События системы
 * - Обновление БД
 */

import { createActor } from 'xstate'

import { prisma } from '@/libs/prisma'
import { eventService } from '@/services/events/EventService'
import { accountAccessService } from '@/services/accounts/AccountAccessService'

import { accountMachine, type AccountContext, type AccountState, accountStateLabels } from './machines/AccountMachine'

// Типы
export interface AccountTransitionInput {
  accountId: string
  event: 'SUSPEND' | 'RESTORE' | 'ARCHIVE' | 'ACTIVATE'
  actorId: string // Кто инициирует
  reason?: string // Причина (для SUSPEND/ARCHIVE)
  metadata?: Record<string, unknown>
}

export interface AccountTransitionResult {
  success: boolean
  fromState: AccountState
  toState: AccountState
  event: string
  error?: string
  account?: {
    id: string
    name: string
    status: string
    userId: string
  }
}

export interface AccountWorkflowState {
  accountId: string
  currentState: AccountState
  context: AccountContext
  availableEvents: string[]
  canSuspend: boolean
  canRestore: boolean
  canArchive: boolean
  canActivate: boolean
}

class AccountWorkflowService {
  private static instance: AccountWorkflowService

  static getInstance(): AccountWorkflowService {
    if (!AccountWorkflowService.instance) {
      AccountWorkflowService.instance = new AccountWorkflowService()
    }

    return AccountWorkflowService.instance
  }

  /**
   * Выполнить переход состояния аккаунта
   */
  async transition(input: AccountTransitionInput): Promise<AccountTransitionResult> {
    const { accountId, event, actorId, reason, metadata } = input

    try {
      // Получить аккаунт
      const account = await prisma.userAccount.findUnique({
        where: { id: accountId },
        include: {
          tariffPlan: true,
          user: true,
          owner: true
        }
      })

      if (!account) {
        return {
          success: false,
          fromState: 'active',
          toState: 'active',
          event,
          error: 'Аккаунт не найден'
        }
      }

      // Проверка прав доступа
      const hasAccess = await accountAccessService.canManageAccount(actorId, accountId)
      if (!hasAccess) {
        return {
          success: false,
          fromState: account.status as AccountState,
          toState: account.status as AccountState,
          event,
          error: 'Недостаточно прав для выполнения операции'
        }
      }

      const fromState = account.status as AccountState

      // Создать контекст машины
      const context: AccountContext = {
        accountId: account.id,
        userId: account.userId,
        ownerId: account.ownerId,
        accountType: account.type,
        tariffPlanId: account.tariffPlanId,
        suspendedBy: undefined,
        archivedBy: undefined,
        reason: reason || undefined
      }

      // Создать actor
      const actorMachine = createActor(accountMachine, {
        input: context
      })

      actorMachine.start()

      // Формируем событие с данными
      const eventPayload = this.buildEventPayload(event, actorId, hasAccess, reason)

      // Проверяем можно ли выполнить переход
      const snapshot = actorMachine.getSnapshot()
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
      const toState = (typeof newSnapshot.value === 'string' ? newSnapshot.value : 'active') as AccountState

      actorMachine.stop()

      // Обновляем БД
      const updateData = this.buildUpdateData(event, toState, actorId, reason)

      await prisma.userAccount.update({
        where: { id: accountId },
        data: updateData
      })

      // Записываем в workflow_transitions
      const workflowInstance = await this.ensureWorkflowInstance(accountId, fromState)

      await prisma.workflowTransition.create({
        data: {
          instanceId: workflowInstance.id,
          fromState,
          toState,
          event,
          actorId,
          actorType: 'user',
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
      await this.handleSideEffects(account, fromState, toState, event, actorId, reason)

      return {
        success: true,
        fromState,
        toState,
        event,
        account: {
          id: account.id,
          name: account.name,
          status: toState,
          userId: account.userId
        }
      }
    } catch (error) {
      console.error('[AccountWorkflowService] Ошибка перехода:', error)

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
   * Получить состояние workflow аккаунта
   */
  async getWorkflowState(accountId: string, actorId?: string): Promise<AccountWorkflowState | null> {
    const account = await prisma.userAccount.findUnique({
      where: { id: accountId }
    })

    if (!account) {
      return null
    }

    const currentState = account.status as AccountState

    // Если есть актор, проверяем доступные действия
    let canSuspend = false
    let canRestore = false
    let canArchive = false
    let canActivate = false

    if (actorId) {
      const hasAccess = await accountAccessService.canManageAccount(actorId, accountId)
      const isOwner = account.ownerId === actorId || account.userId === actorId

      canSuspend = hasAccess && isOwner && currentState === 'active'
      canRestore = hasAccess && isOwner && currentState === 'suspended'
      canArchive = hasAccess && isOwner && ['active', 'suspended'].includes(currentState)
      canActivate = hasAccess && isOwner && currentState === 'archived'
    }

    // Определяем доступные события
    const availableEvents: string[] = []
    if (canSuspend) availableEvents.push('SUSPEND')
    if (canRestore) availableEvents.push('RESTORE')
    if (canArchive) availableEvents.push('ARCHIVE')
    if (canActivate) availableEvents.push('ACTIVATE')

    return {
      accountId: account.id,
      currentState,
      context: {
        accountId: account.id,
        userId: account.userId,
        ownerId: account.ownerId,
        accountType: account.type,
        tariffPlanId: account.tariffPlanId
      },
      availableEvents,
      canSuspend,
      canRestore,
      canArchive,
      canActivate
    }
  }

  /**
   * Получить историю переходов аккаунта
   */
  async getTransitionHistory(accountId: string, limit: number = 50) {
    const instance = await prisma.workflowInstance.findUnique({
      where: { type_entityId: { type: 'account', entityId: accountId } }
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
    hasPermission: boolean,
    reason?: string
  ) {
    switch (event) {
      case 'SUSPEND':
        return { type: 'SUSPEND', actorId, reason: reason || '', hasPermission }
      case 'RESTORE':
        return { type: 'RESTORE', actorId, hasPermission }
      case 'ARCHIVE':
        return { type: 'ARCHIVE', actorId, reason: reason || '', hasPermission }
      case 'ACTIVATE':
        return { type: 'ACTIVATE', actorId, hasPermission }
      default:
        throw new Error(`Неизвестное событие: ${event}`)
    }
  }

  /**
   * Построить данные для обновления БД
   */
  private buildUpdateData(event: string, toState: AccountState, actorId: string, reason?: string) {
    switch (toState) {
      case 'suspended':
        return {
          status: 'suspended'
        }
      case 'archived':
        return {
          status: 'archived'
        }
      case 'active':
        return {
          status: 'active'
        }
      default:
        return { status: toState }
    }
  }

  /**
   * Обеспечить наличие workflow instance
   */
  private async ensureWorkflowInstance(accountId: string, initialState: AccountState) {
    const existing = await prisma.workflowInstance.findUnique({
      where: { type_entityId: { type: 'account', entityId: accountId } }
    })

    if (existing) {
      return existing
    }

    return prisma.workflowInstance.create({
      data: {
        type: 'account',
        entityId: accountId,
        state: initialState,
        context: JSON.stringify({})
      }
    })
  }

  /**
   * Обработка side effects (уведомления, события)
   */
  private async handleSideEffects(
    account: { id: string; name: string; userId: string },
    fromState: AccountState,
    toState: AccountState,
    event: string,
    actorId: string,
    reason?: string
  ) {
    // Логирование события
    const severity = ['suspended', 'archived'].includes(toState) ? 'warning' : 'info'

    await eventService.record({
      source: 'workflow',
      module: 'account',
      type: `account.${event.toLowerCase()}`,
      severity,
      actor: { type: 'user', id: actorId },
      subject: { type: 'account', id: account.id },
      message: `Аккаунт ${account.name} переведён из состояния '${accountStateLabels[fromState]}' в '${accountStateLabels[toState]}'`,
      payload: {
        fromState,
        toState,
        event,
        reason
      }
    })

    // TODO: Уведомление владельцу через NotificationService
  }
}

export const accountWorkflowService = AccountWorkflowService.getInstance()



