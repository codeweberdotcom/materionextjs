import { prisma } from '@/libs/prisma'
import type { UserAccountWithRelations } from '@/types/accounts/interfaces'

export class AccountAccessService {
  private static instance: AccountAccessService

  static getInstance(): AccountAccessService {
    if (!AccountAccessService.instance) {
      AccountAccessService.instance = new AccountAccessService()
    }
    return AccountAccessService.instance
  }

  /**
   * Проверить доступ пользователя к аккаунту
   */
  async canAccessAccount(
    userId: string,
    accountId: string
  ): Promise<boolean> {
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
      return false
    }

    // Владелец имеет доступ
    if (account.userId === userId || account.ownerId === userId) {
      return true
    }

    // Назначенный менеджер имеет доступ
    if (account.managers.some(m => m.userId === userId && m.canManage)) {
      return true
    }

    return false
  }

  /**
   * Проверить права управления аккаунтом
   */
  async canManageAccount(
    userId: string,
    accountId: string
  ): Promise<boolean> {
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
      return false
    }

    // Владелец может управлять
    if (account.userId === userId || account.ownerId === userId) {
      return true
    }

    // Назначенный менеджер с правами управления
    return account.managers.some(m => m.userId === userId && m.canManage)
  }

  /**
   * Проверить права редактирования аккаунта
   */
  async canEditAccount(
    userId: string,
    accountId: string
  ): Promise<boolean> {
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
      return false
    }

    // Владелец может редактировать
    if (account.userId === userId || account.ownerId === userId) {
      return true
    }

    // Назначенный менеджер с правами редактирования
    return account.managers.some(m => m.userId === userId && m.canEdit)
  }

  /**
   * Проверить права удаления аккаунта
   */
  async canDeleteAccount(
    userId: string,
    accountId: string
  ): Promise<boolean> {
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
      return false
    }

    // Только владелец может удалить
    return account.userId === userId || account.ownerId === userId
  }

  /**
   * Получить текущий аккаунт пользователя из сессии
   * (будет реализовано с интеграцией сессий)
   */
  async getCurrentAccount(userId: string): Promise<UserAccountWithRelations | null> {
    // TODO: Интеграция с сессиями/контекстом
    // Пока возвращаем первый аккаунт пользователя
    const accounts = await prisma.userAccount.findMany({
      where: {
        userId,
        status: 'active'
      },
      include: {
        tariffPlan: true,
        user: true,
        owner: true
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 1
    })

    return accounts[0] as UserAccountWithRelations | null
  }

  /**
   * Установить текущий аккаунт пользователя
   * (будет реализовано с интеграцией сессий)
   */
  async setCurrentAccount(userId: string, accountId: string): Promise<void> {
    // Проверяем доступ
    const hasAccess = await this.canAccessAccount(userId, accountId)
    if (!hasAccess) {
      throw new Error('You do not have access to this account')
    }

    // TODO: Сохранение в сессию/контекст
    // Пока просто проверяем доступ
  }
}

export const accountAccessService = AccountAccessService.getInstance()


