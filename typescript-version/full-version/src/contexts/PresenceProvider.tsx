'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSockets } from '@/contexts/SocketProvider'

type PresenceStatus = {
  isOnline: boolean
  lastSeen?: string
  updatedAt: number
}

type PresenceMap = Record<string, PresenceStatus>

type PresenceContextValue = {
  statuses: PresenceMap
  getStatus: (userId: string) => PresenceStatus | undefined
}

const PresenceContext = createContext<PresenceContextValue>({
  statuses: {},
  getStatus: () => undefined
})

const POLL_INTERVAL = 30000

export const PresenceProvider = ({ children }: { children: ReactNode }) => {
  const { notificationSocket, status: socketStatus } = useSockets()
  const [statuses, setStatuses] = useState<PresenceMap>({})

  // запрос статусов сразу после подключения и далее по интервалу
  useEffect(() => {
    if (!notificationSocket || socketStatus !== 'connected') return

    let cancelled = false
    let interval: NodeJS.Timeout | null = null

    const requestSync = () => {
      notificationSocket.emit('presence:sync', undefined, (response: PresenceMap | undefined) => {
        if (cancelled || !response) return
        setStatuses(prev => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(response).map(([userId, value]) => [
              userId,
              { ...value, updatedAt: Date.now() }
            ])
          )
        }))
      })
    }

    // стартовый запрос
    requestSync()

    interval = setInterval(() => {
      if (document.hidden) return
      requestSync()
    }, POLL_INTERVAL)

    const handleVisibility = () => {
      if (!document.hidden) requestSync()
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [notificationSocket, socketStatus])

  const value = useMemo<PresenceContextValue>(
    () => ({
      statuses,
      getStatus: userId => statuses[userId]
    }),
    [statuses]
  )

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export const usePresence = () => useContext(PresenceContext)
