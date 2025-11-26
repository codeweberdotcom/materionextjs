import { prisma } from '@/libs/prisma'
import type { TransferStatus } from '@/types/accounts/types'
import type { AccountTransferWithRelations } from '@/types/accounts/interfaces'

export class AccountTransferService {
  private static instance: AccountTransferService

  static getInstance(): AccountTransferService {
    if (!AccountTransferService.instance) {
      AccountTransferService.instance = new AccountTransferService()
    }
    return AccountTransferService.instance
  }

  /**
   * Запросить передачу аккаунта
   */
  async requestTransfer(
    accountId: string,
    ownerId: string,
    toUserId: string,
    requestedBy: string
  ): Promise<AccountTransferWithRelations> {
    // Проверяем, что запрашивающий является владельцем
    const account = await prisma.userAccount.findUnique({
      where: { id: accountId }
    })

    if (!account) {
      throw new Error('Account not found')
    }

    if (account.ownerId !== ownerId && account.userId !== ownerId) {
      throw new Error('Only account owner can request transfer')
    }

    // Проверяем, что получатель существует
    const toUser = await prisma.user.findUnique({
      where: { id: toUserId }
    })

    if (!toUser) {
      throw new Error('Target user not found')
    }

    // Проверяем, нет ли уже активного запроса
    const existing = await prisma.accountTransfer.findFirst({
      where: {
        fromAccountId: accountId,
        status: 'pending'
      }
    })

    if (existing) {
      throw new Error('There is already a pending transfer request for this account')
    }

    // Создаем запрос на передачу
    const transfer = await prisma.accountTransfer.create({
      data: {
        fromAccountId: accountId,
        toUserId,
        status: 'pending',
        requestedBy
      },
      include: {
        fromAccount: {
          include: {
            tariffPlan: true,
            user: true,
            owner: true
          }
        },
        toUser: true
      }
    })

    return transfer as AccountTransferWithRelations
  }

  /**
   * Принять передачу аккаунта
   */
  async acceptTransfer(
    transferId: string,
    userId: string
  ): Promise<AccountTransferWithRelations> {
    const transfer = await prisma.accountTransfer.findUnique({
      where: { id: transferId },
      include: {
        fromAccount: true,
        toUser: true
      }
    })

    if (!transfer) {
      throw new Error('Transfer request not found')
    }

    if (transfer.toUserId !== userId) {
      throw new Error('You are not authorized to accept this transfer')
    }

    if (transfer.status !== 'pending') {
      throw new Error(`Transfer request is ${transfer.status}, cannot be accepted`)
    }

    // Обновляем статус
    const updated = await prisma.accountTransfer.update({
      where: { id: transferId },
      data: {
        status: 'accepted',
        acceptedAt: new Date()
      },
      include: {
        fromAccount: {
          include: {
            tariffPlan: true,
            user: true,
            owner: true
          }
        },
        toUser: true
      }
    })

    // Передаем аккаунт новому владельцу
    await prisma.userAccount.update({
      where: { id: transfer.fromAccountId },
      data: {
        userId: transfer.toUserId,
        ownerId: transfer.toUserId
      }
    })

    // Отзываем всех менеджеров
    await prisma.accountManager.updateMany({
      where: {
        accountId: transfer.fromAccountId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date(),
        revokedBy: transfer.toUserId,
        canManage: false
      }
    })

    return updated as AccountTransferWithRelations
  }

  /**
   * Отклонить передачу аккаунта
   */
  async rejectTransfer(
    transferId: string,
    userId: string,
    reason?: string
  ): Promise<AccountTransferWithRelations> {
    const transfer = await prisma.accountTransfer.findUnique({
      where: { id: transferId }
    })

    if (!transfer) {
      throw new Error('Transfer request not found')
    }

    if (transfer.toUserId !== userId) {
      throw new Error('You are not authorized to reject this transfer')
    }

    if (transfer.status !== 'pending') {
      throw new Error(`Transfer request is ${transfer.status}, cannot be rejected`)
    }

    const updated = await prisma.accountTransfer.update({
      where: { id: transferId },
      data: {
        status: 'rejected',
        rejectedAt: new Date(),
        reason
      },
      include: {
        fromAccount: {
          include: {
            tariffPlan: true,
            user: true,
            owner: true
          }
        },
        toUser: true
      }
    })

    return updated as AccountTransferWithRelations
  }

  /**
   * Отменить запрос на передачу
   */
  async cancelTransfer(
    transferId: string,
    userId: string
  ): Promise<AccountTransferWithRelations> {
    const transfer = await prisma.accountTransfer.findUnique({
      where: { id: transferId },
      include: {
        fromAccount: true
      }
    })

    if (!transfer) {
      throw new Error('Transfer request not found')
    }

    // Только владелец аккаунта или тот, кто запросил передачу, может отменить
    const canCancel = 
      transfer.fromAccount.ownerId === userId ||
      transfer.fromAccount.userId === userId ||
      transfer.requestedBy === userId

    if (!canCancel) {
      throw new Error('You are not authorized to cancel this transfer')
    }

    if (transfer.status !== 'pending') {
      throw new Error(`Transfer request is ${transfer.status}, cannot be cancelled`)
    }

    const updated = await prisma.accountTransfer.update({
      where: { id: transferId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date()
      },
      include: {
        fromAccount: {
          include: {
            tariffPlan: true,
            user: true,
            owner: true
          }
        },
        toUser: true
      }
    })

    return updated as AccountTransferWithRelations
  }

  /**
   * Получить запросы на передачу для пользователя
   */
  async getTransferRequests(userId: string): Promise<{
    incoming: AccountTransferWithRelations[]
    outgoing: AccountTransferWithRelations[]
  }> {
    const [incoming, outgoing] = await Promise.all([
      // Входящие запросы (где пользователь получатель)
      prisma.accountTransfer.findMany({
        where: {
          toUserId: userId,
          status: 'pending'
        },
        include: {
          fromAccount: {
            include: {
              tariffPlan: true,
              user: true,
              owner: true
            }
          },
          toUser: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      // Исходящие запросы (где пользователь владелец)
      prisma.accountTransfer.findMany({
        where: {
          requestedBy: userId,
          status: 'pending'
        },
        include: {
          fromAccount: {
            include: {
              tariffPlan: true,
              user: true,
              owner: true
            }
          },
          toUser: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ])

    return {
      incoming: incoming as AccountTransferWithRelations[],
      outgoing: outgoing as AccountTransferWithRelations[]
    }
  }
}

export const accountTransferService = AccountTransferService.getInstance()



