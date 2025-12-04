/**
 * AccountRulesService - Сервис для проверки бизнес-правил аккаунтов
 *
 * Использует json-rules-engine для проверки:
 * - Лимитов тарифных планов
 * - Прав доступа
 * - Ограничений на операции
 */

import { rulesService } from '@/services/rules/RulesService'
import { tariffPlanService } from './TariffPlanService'
import { prisma } from '@/libs/prisma'
import type { RuleFacts, EvaluationResult } from '@/services/rules/types'
import type { AccountType } from '@/types/accounts/types'

export class AccountRulesService {
  private static instance: AccountRulesService

  static getInstance(): AccountRulesService {
    if (!AccountRulesService.instance) {
      AccountRulesService.instance = new AccountRulesService()
    }
    return AccountRulesService.instance
  }

  /**
   * Проверить, может ли пользователь создать новый аккаунт
   */
  async canCreateAccount(
    userId: string,
    accountType: AccountType,
    tariffPlanCode?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Получаем тарифный план
    const planCode = (tariffPlanCode || 'FREE') as any
    const tariffPlan = await tariffPlanService.getPlanByCode(planCode)
    
    if (!tariffPlan) {
      return { allowed: false, reason: 'Тарифный план не найден' }
    }

    // Получаем количество аккаунтов пользователя
    const userAccountCount = await prisma.userAccount.count({
      where: { userId, status: { not: 'archived' } }
    })

    // Парсим возможности тарифа
    const features = tariffPlanService.parseFeatures(tariffPlan.features)
    const maxAccounts = tariffPlan.maxAccounts ?? features.maxAccounts ?? 1

    // Подготавливаем факты для правил
    const facts: RuleFacts = {
      userId,
      accountType,
      userAccountCount,
      tariffMaxAccounts: maxAccounts,
      tariffCanAssignManagers: features.canAssignManagers ?? false,
      tariffMaxManagers: features.maxManagers ?? 0
    }

    // Загружаем правила категории 'tariff' и 'limit'
    await rulesService.loadRules('tariff')
    await rulesService.loadRules('limit')

    // Выполняем проверку
    const result = await rulesService.evaluate(facts, {
      category: 'limit' as any
    })

    // Проверяем, есть ли ошибки (события типа limit_exceeded)
    const hasErrors = result.events.some(
      event => event.type === 'account_limit_exceeded' || event.type === 'manager_limit_exceeded'
    )

    if (hasErrors) {
      const errorEvent = result.events.find(
        e => e.type === 'account_limit_exceeded' || e.type === 'manager_limit_exceeded'
      )
      return {
        allowed: false,
        reason: errorEvent?.params?.message as string || 'Превышен лимит'
      }
    }

    return { allowed: true }
  }

  /**
   * Проверить, может ли пользователь назначить менеджера
   */
  async canAssignManager(
    accountId: string,
    ownerId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Получаем аккаунт и тарифный план
    const account = await prisma.userAccount.findUnique({
      where: { id: accountId },
      include: { tariffPlan: true }
    })

    if (!account) {
      return { allowed: false, reason: 'Аккаунт не найден' }
    }

    if (account.ownerId !== ownerId && account.userId !== ownerId) {
      return { allowed: false, reason: 'Только владелец может назначать менеджеров' }
    }

    // Парсим возможности тарифа
    const features = tariffPlanService.parseFeatures(account.tariffPlan.features)
    
    if (!features.canAssignManagers) {
      return { allowed: false, reason: 'Ваш тарифный план не позволяет назначать менеджеров' }
    }

    // Получаем количество менеджеров
    const managerCount = await prisma.accountManager.count({
      where: {
        accountId,
        revokedAt: null
      }
    })

    const maxManagers = account.tariffPlan.maxAccounts ?? features.maxManagers ?? 0

    // Подготавливаем факты
    const facts: RuleFacts = {
      accountId,
      accountOwnerId: account.ownerId,
      accountManagerCount: managerCount,
      tariffCanAssignManagers: features.canAssignManagers,
      tariffMaxManagers: maxManagers
    }

    // Загружаем правила
    await rulesService.loadRules('tariff')
    await rulesService.loadRules('limit')

    // Выполняем проверку
    const result = await rulesService.evaluate(facts, {
      category: 'limit' as any
    })

    // Проверяем ошибки
    const hasErrors = result.events.some(
      event => event.type === 'manager_limit_exceeded'
    )

    if (hasErrors) {
      const errorEvent = result.events.find(e => e.type === 'manager_limit_exceeded')
      return {
        allowed: false,
        reason: errorEvent?.params?.message as string || 'Превышен лимит менеджеров'
      }
    }

    return { allowed: true }
  }

  /**
   * Проверить доступ пользователя к аккаунту с использованием правил
   */
  async checkAccountAccess(
    userId: string,
    accountId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const account = await prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        managers: {
          where: {
            userId,
            revokedAt: null
          }
        }
      }
    })

    if (!account) {
      return { allowed: false, reason: 'Аккаунт не найден' }
    }

    // Проверяем, является ли пользователь владельцем
    const isOwner = account.userId === userId || account.ownerId === userId

    // Проверяем, является ли пользователь менеджером
    const manager = account.managers.find(m => m.userId === userId && !m.revokedAt)

    // Подготавливаем факты
    const facts: RuleFacts = {
      userId,
      accountId,
      accountOwnerId: account.ownerId,
      isManager: !!manager,
      managerCanManage: manager?.canManage ?? false,
      managerRevokedAt: manager?.revokedAt ?? null
    }

    // Загружаем правила доступа
    await rulesService.loadRules('limit')

    // Выполняем проверку
    const result = await rulesService.evaluate(facts, {
      category: 'limit' as any
    })

    // Проверяем, есть ли событие access_granted
    const hasAccess = result.events.some(event => event.type === 'access_granted')

    if (hasAccess) {
      return { allowed: true }
    }

    // Если нет события, проверяем напрямую
    if (isOwner || (manager && manager.canManage)) {
      return { allowed: true }
    }

    return { allowed: false, reason: 'Доступ запрещен' }
  }
}

export const accountRulesService = AccountRulesService.getInstance()



