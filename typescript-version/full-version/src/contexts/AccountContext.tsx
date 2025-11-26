'use client'

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import type { UserAccountWithRelations } from '@/types/accounts/interfaces'

type AccountContextState = {
  currentAccount: UserAccountWithRelations | null
  userAccounts: UserAccountWithRelations[]
  loading: boolean
  error?: string
  switchAccount: (accountId: string) => Promise<void>
  refreshAccounts: () => Promise<void>
}

const AccountContext = createContext<AccountContextState | undefined>(undefined)

const STORAGE_KEY = 'current_account_id'

/**
 * Загрузить список аккаунтов пользователя
 */
const fetchAccounts = async (): Promise<UserAccountWithRelations[]> => {
  const response = await fetch('/api/accounts')

  if (!response.ok) {
    throw new Error('Failed to load accounts')
  }

  const result = await response.json()
  return result.data || []
}

/**
 * Получить текущий аккаунт
 */
const fetchCurrentAccount = async (): Promise<UserAccountWithRelations | null> => {
  const response = await fetch('/api/accounts/current')

  if (!response.ok) {
    if (response.status === 404) {
      return null // Нет текущего аккаунта
    }
    throw new Error('Failed to load current account')
  }

  const result = await response.json()
  return result.data || null
}

/**
 * Переключиться на аккаунт
 */
const switchToAccount = async (accountId: string): Promise<void> => {
  const response = await fetch(`/api/accounts/${accountId}/switch`, {
    method: 'POST'
  })

  if (!response.ok) {
    throw new Error('Failed to switch account')
  }

  // Сохраняем в localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, accountId)
  }
}

export const AccountProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentAccount, setCurrentAccount] = useState<UserAccountWithRelations | null>(null)
  const [userAccounts, setUserAccounts] = useState<UserAccountWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  /**
   * Загрузить список аккаунтов
   */
  const loadAccounts = useCallback(async () => {
    try {
      const accounts = await fetchAccounts()
      setUserAccounts(accounts)
      setError(undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setUserAccounts([])
    }
  }, [])

  /**
   * Загрузить текущий аккаунт
   */
  const loadCurrentAccount = useCallback(async () => {
    try {
      // Сначала пытаемся загрузить из API
      const account = await fetchCurrentAccount()
      
      if (account) {
        setCurrentAccount(account)
        // Сохраняем в localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, account.id)
        }
        return
      }

      // Если нет текущего аккаунта в API, проверяем localStorage
      if (typeof window !== 'undefined') {
        const savedAccountId = localStorage.getItem(STORAGE_KEY)
        
        if (savedAccountId) {
          // Проверяем, есть ли этот аккаунт в списке
          const accounts = await fetchAccounts()
          const savedAccount = accounts.find(a => a.id === savedAccountId)
          
          if (savedAccount) {
            // Переключаемся на сохраненный аккаунт
            await switchToAccount(savedAccountId)
            setCurrentAccount(savedAccount)
            return
          } else {
            // Аккаунт не найден, очищаем localStorage
            localStorage.removeItem(STORAGE_KEY)
          }
        }

        // Если нет сохраненного аккаунта, загружаем список и выбираем первый доступный
        const accounts = await fetchAccounts()
        if (accounts.length > 0) {
          await switchToAccount(accounts[0].id)
          setCurrentAccount(accounts[0])
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setCurrentAccount(null)
    }
  }, [])

  /**
   * Переключиться на аккаунт
   */
  const handleSwitchAccount = useCallback(async (accountId: string) => {
    try {
      setError(undefined)
      await switchToAccount(accountId)
      
      // Обновляем текущий аккаунт из списка
      const account = userAccounts.find(a => a.id === accountId)
      if (account) {
        setCurrentAccount(account)
      } else {
        // Если аккаунт не найден в списке, перезагружаем
        await loadAccounts()
        await loadCurrentAccount()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch account')
      throw err
    }
  }, [userAccounts, loadAccounts, loadCurrentAccount])

  /**
   * Обновить список аккаунтов
   */
  const handleRefreshAccounts = useCallback(async () => {
    try {
      setError(undefined)
      await loadAccounts()
      
      // Если текущий аккаунт был удален, переключаемся на первый доступный
      if (currentAccount && !userAccounts.find(a => a.id === currentAccount.id)) {
        const accounts = await fetchAccounts()
        if (accounts.length > 0) {
          await handleSwitchAccount(accounts[0].id)
        } else {
          setCurrentAccount(null)
          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [currentAccount, userAccounts, handleSwitchAccount])

  /**
   * Инициализация при монтировании
   */
  useEffect(() => {
    const initialize = async () => {
      setLoading(true)
      try {
        // Загружаем список аккаунтов
        await loadAccounts()
        
        // Загружаем текущий аккаунт
        await loadCurrentAccount()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [loadAccounts, loadCurrentAccount])

  const value = useMemo(
    () => ({
      currentAccount,
      userAccounts,
      loading,
      error,
      switchAccount: handleSwitchAccount,
      refreshAccounts: handleRefreshAccounts
    }),
    [currentAccount, userAccounts, loading, error, handleSwitchAccount, handleRefreshAccounts]
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export const useAccount = () => {
  const context = useContext(AccountContext)

  if (!context) {
    throw new Error('useAccount must be used within AccountProvider')
  }

  return context
}

