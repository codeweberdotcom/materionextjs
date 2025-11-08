'use client'

import { useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/contexts/AuthProvider'

export function SocketManager() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) {
      return
    }

    // Получаем токен из API endpoint
    const getToken = async () => {
      try {
        const response = await fetch('/api/auth/session-token')
        if (response.ok) {
          const data = await response.json()
          return data.token
        } else {
          console.error('Failed to get session token:', response.status)
          return ''
        }
      } catch (error) {
        console.error('Error fetching session token:', error)
        return ''
      }
    }

    const initializeSockets = async () => {
      const token = await getToken()
      console.log('SocketManager finalToken:', token ? 'present' : 'empty')

      if (!token) {
        console.error('No token received, cannot connect to sockets')
        return
      }

      // Создаем подключение к namespace чата
      const newChatSocket = io('/chat', {
        transports: ['websocket', 'polling'],
        auth: {
          token: token
        },
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      })

      // Создаем подключение к namespace уведомлений
      const newNotificationSocket = io('/notifications', {
        transports: ['websocket', 'polling'],
        auth: {
          token: token
        },
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      })

      // Обработчики для чата
      newChatSocket.on('connect', () => {
        console.log('Connected to chat namespace, socket id:', newChatSocket.id)
      })

      newChatSocket.on('disconnect', (reason) => {
        console.log('Disconnected from chat namespace, reason:', reason)
      })

      newChatSocket.on('connect_error', (error) => {
        console.error('Chat socket connect error:', error)
      })

      // Обработчики для уведомлений
      newNotificationSocket.on('connect', () => {
        console.log('Connected to notifications namespace')
      })

      newNotificationSocket.on('disconnect', () => {
        console.log('Disconnected from notifications namespace')
      })

      // Обработка ошибок
      const handleError = (error: any) => {
        console.error('Socket error:', error)
      }

      newChatSocket.on('error', handleError)
      newNotificationSocket.on('error', handleError)

      // Начинаем периодический ping каждые 30 секунд для обновления lastSeen
      const pingInterval = setInterval(() => {
        if (newChatSocket.connected) {
          console.log('Sending ping to update lastSeen')
          newChatSocket.emit('ping')
        } else {
          console.log('Socket not connected, skipping ping')
        }
      }, 30000) // 30 секунд

      // Store cleanup function
      const cleanup = () => {
        console.log('Cleaning up sockets')
        clearInterval(pingInterval)
        newChatSocket.close()
        newNotificationSocket.close()
      }

      // Cleanup on unmount or user change
      return cleanup
    }

    const cleanupPromise = initializeSockets()

    return () => {
      cleanupPromise.then(cleanup => cleanup?.())
    }
  }, [user?.id])

  return null // This component doesn't render anything
}