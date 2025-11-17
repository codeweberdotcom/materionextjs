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
      logger.info('🔍 [AUTH] Checking authentication...')
      const response = await fetch('/api/auth/session')
      logger.info('🔍 [AUTH] Session response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        logger.info('✅ [AUTH] User authenticated:', data.user?.email)
        setUser(data.user)
        setSession(data.session)
      } else {
        logger.info('❌ [AUTH] User not authenticated')
        setUser(null)
        setSession(null)
      }
    } catch (error) {
      logger.error('❌ [AUTH] Auth check failed:', { error: error, file: 'src/contexts/AuthProvider.tsx' })
      setUser(null)
      setSession(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    logger.info('🔐 [AUTH] Attempting login for:', email)

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    logger.info('🔐 [AUTH] Login response status:', response.status)

    if (!response.ok) {
      const error = await response.json()
      logger.error('❌ [AUTH] Login failed:', { error: error.error, file: 'src/contexts/AuthProvider.tsx' })
      throw new Error(error.error || 'Login failed')
    }

    const data = await response.json()
    logger.info('✅ [AUTH] Login successful for:', data.user?.email)

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
        logger.error('❌ [AUTH] Logout failed with status:', { error: response.status, file: 'src/contexts/AuthProvider.tsx' })
      }
    } catch (error) {
      logger.error('❌ [AUTH] Logout request failed:', { error: error, file: 'src/contexts/AuthProvider.tsx' })
    }

    // Всегда очищаем локальное состояние, независимо от ответа сервера
    setUser(null)
    setSession(null)
    logger.info('🧹 [AUTH] Local state cleared')
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      login,
      logout
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
