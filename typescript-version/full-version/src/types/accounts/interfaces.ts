/**
 * Интерфейсы для системы аккаунтов пользователей
 */

import type { AccountType, AccountStatus, TransferStatus, TariffPlanCode, TariffPlanFeatures, AccountManagerPermissions } from './types'
import type { UserAccount, TariffPlan, AccountManager, AccountTransfer, User } from '@prisma/client'

/**
 * Аккаунт пользователя с отношениями
 */
export interface UserAccountWithRelations extends UserAccount {
  tariffPlan: TariffPlan
  user: User
  owner: User
  managers?: AccountManagerWithUser[]
}

/**
 * Менеджер аккаунта с информацией о пользователе
 */
export interface AccountManagerWithUser extends AccountManager {
  user: User
  account: UserAccount
}

/**
 * Тарифный план с возможностями
 */
export interface TariffPlanWithFeatures extends TariffPlan {
  featuresParsed: TariffPlanFeatures
}

/**
 * Запрос на передачу аккаунта с отношениями
 */
export interface AccountTransferWithRelations extends AccountTransfer {
  fromAccount: UserAccount
  toUser: User
  account?: UserAccount // Alias for fromAccount
  fromUser?: User // Запросивший передачу
}

/**
 * Данные для создания аккаунта
 */
export interface CreateAccountInput {
  type: AccountType
  name: string
  description?: string
  tariffPlanCode?: TariffPlanCode
}

/**
 * Данные для обновления аккаунта
 */
export interface UpdateAccountInput {
  name?: string
  description?: string
  status?: AccountStatus
  tariffPlanId?: string
}

/**
 * Данные для назначения менеджера
 */
export interface AssignManagerInput {
  userId: string
  permissions: AccountManagerPermissions
}

/**
 * Данные для запроса передачи аккаунта
 */
export interface TransferAccountInput {
  toUserId: string
}

/**
 * Данные для принятия/отклонения передачи
 */
export interface RespondToTransferInput {
  reason?: string
}


