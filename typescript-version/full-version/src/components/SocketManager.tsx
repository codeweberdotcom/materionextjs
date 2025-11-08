'use client'

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/contexts/AuthProvider'

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')
const SESSION_TOKEN_ENDPOINT = API_BASE_URL
  ? `${API_BASE_URL}/auth/session-token`
  : '/api/auth/session-token'
const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, '')
const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io'
const SOCKETS_ENABLED = (process.env.NEXT_PUBLIC_ENABLE_SOCKET_IO ?? 'true') !== 'false'

export function SocketManager() {
  const { user } = useAuth()
  const hasWarnedRef = useRef(false)

  useEffect(() => {
    if (!SOCKETS_ENABLED || !user?.id) {
      return
    }

    let chatSocket: Socket | null = null
    let notificationSocket: Socket | null = null
    let pingInterval: ReturnType<typeof setInterval> | null = null
    let disposed = false

    const log = (message: string, error?: unknown, severity: 'warn' | 'error' = 'warn') => {
      const payload = error instanceof Error ? error : error ? new Error(String(error)) : undefined

      if (severity === 'warn' || process.env.NODE_ENV === 'development') {
        console.warn(`[SocketManager] ${message}`, payload)
      } else {
        console.error(`[SocketManager] ${message}`, payload)
      }
    }

    const buildNamespaceUrl = (namespace: string) => {
      if (SOCKET_BASE_URL) {
        return `${SOCKET_BASE_URL}${namespace}`
      }

      return namespace
    }

    const getToken = async () => {
      try {
        const response = await fetch(SESSION_TOKEN_ENDPOINT, {
          credentials: 'include'
        })

        if (!response.ok) {
          log(`Failed to get session token (status ${response.status}).`)
          return ''
        }

        const data = await response.json()
        return data.token as string
      } catch (error) {
        log('Error fetching session token.', error)
        return ''
      }
    }

    const warnAboutServer = (error?: unknown) => {
      if (hasWarnedRef.current) {
        return
      }

      hasWarnedRef.current = true
      log(
        'Unable to reach the Socket.IO server. Ensure it is running (e.g. `pnpm run dev:with-socket`) or disable it via NEXT_PUBLIC_ENABLE_SOCKET_IO=false.',
        error
      )
    }

    const initializeSockets = async () => {
      try {
        const token = await getToken()

        if (!token || disposed) {
          if (!token) {
            log('No token received, skipping socket initialization.')
          }

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

        chatSocket = io(buildNamespaceUrl('/chat'), sharedOptions)
        notificationSocket = io(buildNamespaceUrl('/notifications'), sharedOptions)

        chatSocket.on('connect', () => {
          hasWarnedRef.current = false
          console.log('[SocketManager] Connected to chat namespace', chatSocket?.id)
        })

        chatSocket.on('disconnect', reason => {
          console.log('[SocketManager] Disconnected from chat namespace:', reason)
        })

        chatSocket.on('connect_error', error => {
          warnAboutServer(error)
        })

        notificationSocket.on('connect', () => {
          hasWarnedRef.current = false
          console.log('[SocketManager] Connected to notifications namespace')
        })

        notificationSocket.on('disconnect', () => {
          console.log('[SocketManager] Disconnected from notifications namespace')
        })

        notificationSocket.on('connect_error', error => {
          warnAboutServer(error)
        })

        const handleError = (error: unknown) => {
          log('Socket error received.', error)
        }

        chatSocket.on('error', handleError)
        notificationSocket.on('error', handleError)

        pingInterval = setInterval(() => {
          if (chatSocket?.connected) {
            chatSocket.emit('ping')
          }
        }, 30000)
      } catch (error) {
        log('Unexpected error while initializing sockets.', error, 'error')
      }
    }

    initializeSockets()

    return () => {
      disposed = true

      if (pingInterval) {
        clearInterval(pingInterval)
      }

      chatSocket?.close()
      notificationSocket?.close()
    }
  }, [user?.id])

  return null
}
