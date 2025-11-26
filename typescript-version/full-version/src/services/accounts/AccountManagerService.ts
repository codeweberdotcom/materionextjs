import { prisma } from '@/libs/prisma'
import type { AccountManagerPermissions } from '@/types/accounts/types'
import type { AccountManagerWithUser } from '@/types/accounts/interfaces'

export class AccountManagerService {
  private static instance: AccountManagerService

  static getInstance(): AccountManagerService {
    if (!AccountManagerService.instance) {
      AccountManagerService.instance = new AccountManagerService()
    }
    return AccountManagerService.instance
  }

  /**
   * Назначить менеджера для аккаунта
   */
  async assignManager(
    accountId: string,
    ownerId: string,
    userId: string,
    permissions: AccountManagerPermissions,
    assignedBy: string
  ): Promise<AccountManagerWithUser> {
    // Проверяем, что запрашивающий является владельцем
    const account = await prisma.userAccount.findUnique({
      where: { id: accountId }
    })

    if (!account) {
      throw new Error('Account not found')
    }

    if (account.ownerId !== ownerId && account.userId !== ownerId) {
      throw new Error('Only account owner can assign managers')
    }

    // Проверяем, что пользователь существует
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Проверяем, не назначен ли уже этот пользователь
    const existing = await prisma.accountManager.findUnique({
      where: {
        accountId_userId: {
          accountId,
          userId
        }
      }
    })

    if (existing && !existing.revokedAt) {
      // Обновляем существующее назначение
      const updated = await prisma.accountManager.update({
        where: {
          id: existing.id
        },
        data: {
          canManage: permissions.canManage,
          canEdit: permissions.canEdit,
          canDelete: permissions.canDelete,
          revokedAt: null,
          revokedBy: null,
          assignedBy,
          assignedAt: new Date()
        },
        include: {
          user: true,
          account: true
        }
      })

      return updated as AccountManagerWithUser
    }

    // Создаем новое назначение
    const manager = await prisma.accountManager.create({
      data: {
        accountId,
        userId,
        canManage: permissions.canManage,
        canEdit: permissions.canEdit,
        canDelete: permissions.canDelete,
        assignedBy,
        assignedAt: new Date()
      },
      include: {
        user: true,
        account: true
      }
    })

    return manager as AccountManagerWithUser
  }

  /**
   * Отозвать права менеджера
   */
  async revokeManager(
    accountId: string,
    ownerId: string,
    managerId: string,
    revokedBy: string
  ): Promise<void> {
    // Проверяем, что запрашивающий является владельцем
    const account = await prisma.userAccount.findUnique({
      where: { id: accountId }
    })

    if (!account) {
      throw new Error('Account not found')
    }

    if (account.ownerId !== ownerId && account.userId !== ownerId) {
      throw new Error('Only account owner can revoke managers')
    }

    // Отзываем права
    await prisma.accountManager.update({
      where: {
        id: managerId
      },
      data: {
        revokedAt: new Date(),
        revokedBy,
        canManage: false
      }
    })
  }

  /**
   * Получить аккаунты, которыми управляет пользователь
   */
  async getManagedAccounts(userId: string): Promise<AccountManagerWithUser[]> {
    return prisma.accountManager.findMany({
      where: {
        userId,
        canManage: true,
        revokedAt: null
      },
      include: {
        user: true,
        account: {
          include: {
            tariffPlan: true,
            user: true,
            owner: true
          }
        }
      }
    }) as Promise<AccountManagerWithUser[]>
  }

  /**
   * Получить список менеджеров аккаунта
   */
  async getAccountManagers(
    accountId: string,
    ownerId: string
  ): Promise<AccountManagerWithUser[]> {
    // Проверяем права доступа
    const account = await prisma.userAccount.findUnique({
      where: { id: accountId }
    })

    if (!account) {
      throw new Error('Account not found')
    }

    if (account.ownerId !== ownerId && account.userId !== ownerId) {
      throw new Error('Only account owner can view managers')
    }

    return prisma.accountManager.findMany({
      where: {
        accountId
      },
      include: {
        user: true,
        account: true
      },
      orderBy: {
        assignedAt: 'desc'
      }
    }) as Promise<AccountManagerWithUser[]>
  }

  /**
   * Обновить права менеджера
   */
  async updateManagerPermissions(
    accountId: string,
    ownerId: string,
    managerId: string,
    permissions: AccountManagerPermissions
  ): Promise<AccountManagerWithUser> {
    // Проверяем права доступа
    const account = await prisma.userAccount.findUnique({
      where: { id: accountId }
    })

    if (!account) {
      throw new Error('Account not found')
    }

    if (account.ownerId !== ownerId && account.userId !== ownerId) {
      throw new Error('Only account owner can update manager permissions')
    }

    const updated = await prisma.accountManager.update({
      where: {
        id: managerId
      },
      data: {
        canManage: permissions.canManage,
        canEdit: permissions.canEdit,
        canDelete: permissions.canDelete
      },
      include: {
        user: true,
        account: true
      }
    })

    return updated as AccountManagerWithUser
  }
}

export const accountManagerService = AccountManagerService.getInstance()


