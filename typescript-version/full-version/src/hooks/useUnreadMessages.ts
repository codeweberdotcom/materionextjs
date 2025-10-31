import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useSocket } from './useSocket'

export const useUnreadMessages = () => {
  const { data: session } = useSession()
  const { socket } = useSocket(session?.user?.id || null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // Function to fetch unread messages count from API
  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user?.id) return

    try {
      setIsLoading(true)
      const response = await fetch('/api/chat/unread')
      if (response.ok) {
        const data = await response.json()
        setUnreadCount(data.count || 0)
      }
    } catch (error) {
      console.error('Error fetching unread messages count:', error)
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id])

  // Fetch unread count on mount and when session changes
  useEffect(() => {
    if (session?.user?.id) {
      fetchUnreadCount()
    }
  }, [session?.user?.id, fetchUnreadCount])

  // Listen for real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = () => {
      console.log('📨 [UNREAD] New message received, updating count')
      fetchUnreadCount()
    }

    const handleMessagesRead = () => {
      console.log('📖 [UNREAD] Messages marked as read, updating count')
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
      if (session?.user?.id && !isLoading) {
        fetchUnreadCount()
      }
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [session?.user?.id, isLoading, fetchUnreadCount])

  // Update when window gets focus
  useEffect(() => {
    const handleFocus = () => {
      if (session?.user?.id) {
        fetchUnreadCount()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [session?.user?.id, fetchUnreadCount])

  // Update when page becomes visible (user returns from another tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && session?.user?.id) {
        fetchUnreadCount()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [session?.user?.id, fetchUnreadCount])

  return {
    unreadCount,
    isLoading,
    refetch: fetchUnreadCount
  }
}