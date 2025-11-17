'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from '@/contexts/AuthProvider'

type SocketStatus = 'idle' | 'disabled' | 'connecting' | 'connected' | 'disconnected'

type SocketContextValue = {
  chatSocket: Socket | null
  notificationSocket: Socket | null
  status: SocketStatus
  lastError?: string
  socketsEnabled: boolean
}

const SOCKETS_ENABLED = (process.env.NEXT_PUBLIC_ENABLE_SOCKET_IO ?? 'true') !== 'false'
const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, '')
const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io'
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')
const SESSION_TOKEN_ENDPOINT = API_BASE_URL
  ? `${API_BASE_URL}/auth/session-token`
  : '/api/auth/session-token'

const SocketContext = createContext<SocketContextValue>({
  chatSocket: null,
  notificationSocket: null,
  status: SOCKETS_ENABLED ? 'idle' : 'disabled',
  socketsEnabled: SOCKETS_ENABLED
})

const buildNamespaceUrl = (namespace: string) => {
  if (SOCKET_BASE_URL) {
    return `${SOCKET_BASE_URL}${namespace}`
  }

  return namespace
}

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const [status, setStatus] = useState<SocketStatus>(SOCKETS_ENABLED ? 'idle' : 'disabled')
  const [lastError, setLastError] = useState<string>()
  const [chatSocket, setChatSocket] = useState<Socket | null>(null)
  const [notificationSocket, setNotificationSocket] = useState<Socket | null>(null)
  const pingRef = useRef<NodeJS.Timeout | null>(null)

  const cleanupSockets = () => {
    if (pingRef.current) {
      clearInterval(pingRef.current)
      pingRef.current = null
    }

    setChatSocket(prev => {
      prev?.off()
      prev?.close()
      return null
    })

    setNotificationSocket(prev => {
      prev?.off()
      prev?.close()
      return null
    })
  }

  useEffect(() => {
    if (!SOCKETS_ENABLED) {
      cleanupSockets()
      setStatus('disabled')
      return
    }

    if (!user?.id) {
      cleanupSockets()
      setStatus('idle')
      return
    }

    let disposed = false
    setStatus('connecting')

    const getToken = async () => {
      try {
        const response = await fetch(SESSION_TOKEN_ENDPOINT, {
          credentials: 'include'
        })

        if (!response.ok) {
          setLastError(`Failed to fetch session token (status ${response.status}).`)
          return ''
        }

        const data = await response.json()
        return data.token as string
      } catch (error) {
        setLastError(error instanceof Error ? error.message : 'Unable to fetch session token.')
        return ''
      }
    }

    const initializeSockets = async () => {
      const token = await getToken()
      if (!token || disposed) {
        setStatus('disconnected')
        return
      }

      const sharedOptions = {
        transports: ['websocket', 'polling'],
        auth: { token },
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        path: SOCKET_PATH,
        withCredentials: Boolean(SOCKET_BASE_URL)
      }

      const nextChatSocket = io(buildNamespaceUrl('/chat'), sharedOptions)
      const nextNotificationSocket = io(buildNamespaceUrl('/notifications'), sharedOptions)

      const updateStatus = () => {
        const anyConnected = nextChatSocket.connected || nextNotificationSocket.connected
        setStatus(anyConnected ? 'connected' : 'disconnected')
      }

      const handleError = (error: Error) => {
        setLastError(error.message)
        setStatus('disconnected')
      }

      nextChatSocket.on('connect', updateStatus)
      nextChatSocket.on('disconnect', updateStatus)
      nextChatSocket.on('connect_error', handleError)
      nextChatSocket.on('error', handleError)

      nextNotificationSocket.on('connect', updateStatus)
      nextNotificationSocket.on('disconnect', updateStatus)
      nextNotificationSocket.on('connect_error', handleError)
      nextNotificationSocket.on('error', handleError)

      setChatSocket(nextChatSocket)
      setNotificationSocket(nextNotificationSocket)

      pingRef.current = setInterval(() => {
        if (nextNotificationSocket.connected) {
          nextNotificationSocket.emit('ping')
        }
      }, 30000)
    }

    initializeSockets()

    return () => {
      disposed = true
      cleanupSockets()
      setStatus(SOCKETS_ENABLED ? 'idle' : 'disabled')
    }
  }, [user?.id])

  const value = useMemo(
    () => ({
      chatSocket,
      notificationSocket,
      status,
      lastError,
      socketsEnabled: SOCKETS_ENABLED
    }),
    [chatSocket, notificationSocket, status, lastError]
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export const useSockets = () => useContext(SocketContext)
