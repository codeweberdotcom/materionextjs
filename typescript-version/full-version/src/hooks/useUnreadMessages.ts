import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthProvider'
import { useSocket } from './useSocket'

export const useUnreadMessages = () => {
  const { user, session } = useAuth()
  const { socket } = useSocket(user?.id || null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // Function to fetch unread messages count from API
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)
      const response = await fetch('/api/chat/unread')
      if (response.ok) {
        const data = await response.json()
        setUnreadCount(data.count || 0)
      }
    } catch (error) {
      // Error handling
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  // Fetch unread count on mount and when session changes
  useEffect(() => {
    if (user?.id) {
      fetchUnreadCount()
    }
  }, [user?.id, fetchUnreadCount])

  // Listen for real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = () => {
      fetchUnreadCount()
    }

    const handleMessagesRead = () => {
      fetchUnreadCount()
    }

    socket.on('receiveMessage', handleNewMessage)
    socket.on('messagesRead', handleMessagesRead)

    return () => {
      socket.off('receiveMessage', handleNewMessage)
      socket.off('messagesRead', handleMessagesRead)
    }
  }, [socket, fetchUnreadCount])

  // Periodic refresh every 60 seconds as fallback
  useEffect(() => {
    const interval = setInterval(() => {
      if (user?.id && !isLoading) {
        fetchUnreadCount()
      }
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [user?.id, isLoading, fetchUnreadCount])

  // Update when window gets focus
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id) {
        fetchUnreadCount()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [user?.id, fetchUnreadCount])

  // Update when page becomes visible (user returns from another tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.id) {
        fetchUnreadCount()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user?.id, fetchUnreadCount])

  return {
    unreadCount,
    isLoading,
    refetch: fetchUnreadCount
  }
}
