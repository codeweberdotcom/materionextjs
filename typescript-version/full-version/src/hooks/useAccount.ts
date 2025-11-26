/**
 * Хуки для работы с аккаунтами
 * 
 * Удобные обертки над AccountContext
 */

import { useAccount as useAccountContext } from '@/contexts/AccountContext'
import type { UserAccountWithRelations } from '@/types/accounts/interfaces'

/**
 * Получить текущий аккаунт
 */
export const useCurrentAccount = (): UserAccountWithRelations | null => {
  const { currentAccount } = useAccountContext()
  return currentAccount
}

/**
 * Получить список всех аккаунтов пользователя
 */
export const useUserAccounts = (): UserAccountWithRelations[] => {
  const { userAccounts } = useAccountContext()
  return userAccounts
}

/**
 * Переключиться на аккаунт
 */
export const useSwitchAccount = () => {
  const { switchAccount } = useAccountContext()
  return switchAccount
}

/**
 * Получить полный контекст аккаунта
 * (для случаев, когда нужны все данные сразу)
 */
export const useAccount = useAccountContext

/**
 * Проверить, есть ли у пользователя аккаунты
 */
export const useHasAccounts = (): boolean => {
  const { userAccounts } = useAccountContext()
  return userAccounts.length > 0
}

/**
 * Проверить, есть ли текущий аккаунт
 */
export const useHasCurrentAccount = (): boolean => {
  const { currentAccount } = useAccountContext()
  return currentAccount !== null
}

/**
 * Получить количество аккаунтов
 */
export const useAccountCount = (): number => {
  const { userAccounts } = useAccountContext()
  return userAccounts.length
}


