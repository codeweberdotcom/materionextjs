import { prisma } from '@/libs/prisma'
import { tariffPlanService } from './TariffPlanService'
import { accountRulesService } from './AccountRulesService'
import type { AccountType, TariffPlanCode } from '@/types/accounts/types'
import type { CreateAccountInput, UpdateAccountInput, UserAccountWithRelations } from '@/types/accounts/interfaces'

export class AccountService {
  private static instance: AccountService

  static getInstance(): AccountService {
    if (!AccountService.instance) {
      AccountService.instance = new AccountService()
    }
    return AccountService.instance
  }

  /**
   * Создать аккаунт для пользователя
   */
  async createAccount(
    userId: string,
    type: AccountType,
    tariffPlanCode?: TariffPlanCode
  ): Promise<UserAccountWithRelations> {
    // Проверяем бизнес-правила (лимиты тарифного плана)
    const canCreate = await accountRulesService.canCreateAccount(userId, type, tariffPlanCode)
    if (!canCreate.allowed) {
      throw new Error(canCreate.reason || 'Нельзя создать аккаунт')
    }

    // Получаем тарифный план (по умолчанию FREE)
    const planCode = tariffPlanCode || 'FREE'
    const tariffPlan = await tariffPlanService.getPlanByCode(planCode)
    
    if (!tariffPlan) {
      throw new Error(`Tariff plan with code ${planCode} not found`)
    }

    // Генерируем название аккаунта на основе типа
    const accountName = this.generateAccountName(type)

    // Создаем аккаунт
    const account = await prisma.userAccount.create({
      data: {
        userId,
        ownerId: userId, // При создании владелец = пользователь
        type,
        name: accountName,
        tariffPlanId: tariffPlan.id,
        status: 'active'
      },
      include: {
        tariffPlan: true,
        user: true,
        owner: true
      }
    })

    return account as UserAccountWithRelations
  }

  /**
   * Создать аккаунт с полными данными
   */
  async createAccountWithData(
    userId: string,
    data: CreateAccountInput
  ): Promise<UserAccountWithRelations> {
    const planCode = data.tariffPlanCode || 'FREE'
    const tariffPlan = await tariffPlanService.getPlanByCode(planCode)
    
    if (!tariffPlan) {
      throw new Error(`Tariff plan with code ${planCode} not found`)
    }

    const account = await prisma.userAccount.create({
      data: {
        userId,
        ownerId: userId,
        type: data.type,
        name: data.name,
        description: data.description,
        tariffPlanId: tariffPlan.id,
        status: 'active'
      },
      include: {
        tariffPlan: true,
        user: true,
        owner: true
      }
    })

    return account as UserAccountWithRelations
  }

  /**
   * Получить все аккаунты пользователя
   */
  async getUserAccounts(userId: string): Promise<UserAccountWithRelations[]> {
    return prisma.userAccount.findMany({
      where: {
        userId
      },
      include: {
        tariffPlan: true,
        user: true,
        owner: true,
        managers: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }) as Promise<UserAccountWithRelations[]>
  }

  /**
   * Получить аккаунт по ID с проверкой доступа
   */
  async getAccountById(
    accountId: string,
    userId: string
  ): Promise<UserAccountWithRelations | null> {
    const account = await prisma.userAccount.findUnique({
      where: {
        id: accountId
      },
      include: {
        tariffPlan: true,
        user: true,
        owner: true,
        managers: {
          where: {
            userId,
            canManage: true,
            revokedAt: null
          },
          include: {
            user: true
          }
        }
      }
    })

    if (!account) {
      return null
    }

    // Проверяем доступ: владелец или назначенный менеджер
    const hasAccess = 
      account.userId === userId || 
      account.ownerId === userId ||
      account.managers.some(m => m.userId === userId && m.canManage && !m.revokedAt)

    if (!hasAccess) {
      return null
    }

    return account as UserAccountWithRelations
  }

  /**
   * Обновить аккаунт
   */
  async updateAccount(
    accountId: string,
    userId: string,
    data: UpdateAccountInput
  ): Promise<UserAccountWithRelations> {
    // Проверяем доступ
    const account = await this.getAccountById(accountId, userId)
    if (!account) {
      throw new Error('Account not found or access denied')
    }

    // Проверяем права на редактирование
    const canEdit = 
      account.userId === userId || 
      account.ownerId === userId ||
      account.managers?.some(m => m.userId === userId && m.canEdit && !m.revokedAt)

    if (!canEdit) {
      throw new Error('You do not have permission to edit this account')
    }

    // Обновляем аккаунт
    const updated = await prisma.userAccount.update({
      where: {
        id: accountId
      },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status && { status: data.status }),
        ...(data.tariffPlanId && { tariffPlanId: data.tariffPlanId })
      },
      include: {
        tariffPlan: true,
        user: true,
        owner: true
      }
    })

    return updated as UserAccountWithRelations
  }

  /**
   * Удалить аккаунт
   */
  async deleteAccount(accountId: string, userId: string): Promise<void> {
    const account = await this.getAccountById(accountId, userId)
    if (!account) {
      throw new Error('Account not found or access denied')
    }

    // Только владелец может удалить аккаунт
    if (account.userId !== userId && account.ownerId !== userId) {
      throw new Error('Only account owner can delete the account')
    }

    await prisma.userAccount.delete({
      where: {
        id: accountId
      }
    })
  }

  /**
   * Генерация названия аккаунта на основе типа
   */
  private generateAccountName(type: AccountType): string {
    const timestamp = new Date().toLocaleDateString('ru-RU')
    const typeNames = {
      LISTING: 'Аккаунт для объявлений',
      COMPANY: 'Аккаунт компании',
      NETWORK: 'Сеть компаний'
    }
    return `${typeNames[type]} - ${timestamp}`
  }
}

export const accountService = AccountService.getInstance()

