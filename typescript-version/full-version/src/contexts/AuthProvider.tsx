'use client'

import logger from '@/lib/logger'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { lucia } from '@/libs/lucia'

interface UserRole {
  id: string
  name: string
  permissions: string
}

export interface User {
  id: string
  email: string
  name: string
  image?: string | null
  role: UserRole
}

export interface SessionInfo {
  user: Pick<User, 'id' | 'email' | 'name' | 'image'>
}

interface AuthContextType {
  user: User | null
  session: SessionInfo | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

interface RateLimitError extends Error {
  retryAfter?: number
}

interface LoginError extends Error {
  warning?: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is authenticated on mount
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // Убрали избыточное логирование - проверка аутентификации происходит часто
      const response = await fetch('/api/auth/session', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        // Логируем только в режиме отладки
        logger.debug('✅ [AUTH] User authenticated', { email: data.user?.email })
        setUser(data.user)
        setSession(data.session)
      } else {
        // Не логируем обычное отсутствие аутентификации - это нормально
        logger.debug('❌ [AUTH] User not authenticated')
        setUser(null)
        setSession(null)
      }
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : error 
          ? String(error) 
          : 'Unknown error'
      const errorDetails = error instanceof Error && error.stack
        ? { message: errorMessage, stack: error.stack }
        : { message: errorMessage }
      
      // Ошибки оставляем на уровне ERROR - они важны
      logger.error('❌ [AUTH] Auth check failed:', errorDetails)
      setUser(null)
      setSession(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    logger.info('🔐 [AUTH] Attempting login for:', { email })

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    logger.info('🔐 [AUTH] Login response status:', response.status)

    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch (e) {
        errorData = { error: { message: 'Unknown error' } }
      }

      // Извлекаем сообщение об ошибке из структуры ответа
      // createErrorResponse возвращает { error: { code, message, details } }
      let errorMessage = 'Login failed'
      if (errorData?.error?.message) {
        errorMessage = errorData.error.message
      } else if (errorData?.error && typeof errorData.error === 'string') {
        errorMessage = errorData.error
      } else if (errorData?.message) {
        errorMessage = typeof errorData.message === 'string' ? errorData.message : String(errorData.message)
      } else if (errorData?.error) {
        // Если error это объект, попробуем извлечь message или преобразовать в строку
        if (typeof errorData.error === 'object' && errorData.error !== null) {
          errorMessage = errorData.error.message || errorData.error.code || JSON.stringify(errorData.error)
        } else {
          errorMessage = String(errorData.error)
        }
      }
      
      const logClientError = response.status >= 400 && response.status < 500
        ? logger.warn.bind(logger)
        : logger.error.bind(logger)
      logClientError('❌ [AUTH] Login failed:', { error: errorMessage, status: response.status, file: 'src/contexts/AuthProvider.tsx' })

      // Если rate limit, передаем retryAfter
      if (response.status === 429) {
        const retryAfter = errorData?.retryAfter || errorData?.error?.details?.retryAfter
        logger.info('🚫 [AUTH] Rate limit triggered, retryAfter:', retryAfter)
        const rateLimitError: RateLimitError = new Error(errorMessage)
        if (retryAfter) {
          rateLimitError.retryAfter = retryAfter
        }
        throw rateLimitError
      }

      // Передаем warning вместе с ошибкой
      const loginError: LoginError = new Error(errorMessage)
      const warning = errorData?.warning || errorData?.error?.details?.warning
      if (warning) {
        loginError.warning = typeof warning === 'string' ? warning : String(warning)
      }
      throw loginError
    }

    const data = await response.json()
    logger.info('✅ [AUTH] Login successful for:', { email: data.user?.email })

    setUser(data.user)
    setSession(data.session)
  }

  const logout = async () => {
    logger.info('🚪 [AUTH] Starting logout...')
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include' // Важно для отправки cookies
      })
      logger.info('🚪 [AUTH] Logout response status:', response.status)

      if (response.ok) {
        logger.info('✅ [AUTH] Logout successful')
      } else {
        logger.error('❌ [AUTH] Logout failed with status:', { status: response.status, file: 'src/contexts/AuthProvider.tsx' })
      }
    } catch (error) {
      logger.error('❌ [AUTH] Logout request failed:', { error: error instanceof Error ? error.message : 'Unknown error', file: 'src/contexts/AuthProvider.tsx' })
    }

    // Всегда очищаем локальное состояние, независимо от ответа сервера
    setUser(null)
    setSession(null)
    logger.info('🧹 [AUTH] Local state cleared')
  }

  const refreshSession = async () => {
    await checkAuth()
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      login,
      logout,
      refreshSession
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
