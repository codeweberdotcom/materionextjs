import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useSocket } from './useSocket'

export const useUnreadByContact = () => {
  const { data: session } = useSession()
  const { socket } = useSocket(session?.user?.id || null)
  const [unreadByContact, setUnreadByContact] = useState<{ [contactId: string]: number }>({})
  const [isLoading, setIsLoading] = useState(false)

  // Function to fetch unread messages count by contact from API
  const fetchUnreadByContact = useCallback(async () => {
    if (!session?.user?.id) return

    try {
      setIsLoading(true)
      const response = await fetch('/api/chat/unread-by-contact')
      if (response.ok) {
        const data = await response.json()
        setUnreadByContact(data)
        console.log('📊 [UNREAD BY CONTACT] Updated unread counts:', data)
      }
    } catch (error) {
      console.error('Error fetching unread messages by contact:', error)
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id])

  // Fetch unread count on mount and when session changes
  useEffect(() => {
    if (session?.user?.id) {
      fetchUnreadByContact()
    }
  }, [session?.user?.id, fetchUnreadByContact])

  // Listen for real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = () => {
      console.log('📨 [UNREAD BY CONTACT] New message received, updating counts')
      fetchUnreadByContact()
    }

    const handleMessagesRead = () => {
      console.log('📖 [UNREAD BY CONTACT] Messages marked as read, updating counts')
      fetchUnreadByContact()
    }

    socket.on('receiveMessage', handleNewMessage)
    socket.on('messagesRead', handleMessagesRead)

    return () => {
      socket.off('receiveMessage', handleNewMessage)
      socket.off('messagesRead', handleMessagesRead)
    }
  }, [socket, fetchUnreadByContact])

  // Periodic refresh every 60 seconds as fallback
  useEffect(() => {
    const interval = setInterval(() => {
      if (session?.user?.id && !isLoading) {
        fetchUnreadByContact()
      }
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [session?.user?.id, isLoading, fetchUnreadByContact])

  // Update when window gets focus
  useEffect(() => {
    const handleFocus = () => {
      if (session?.user?.id) {
        fetchUnreadByContact()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [session?.user?.id, fetchUnreadByContact])

  // Update when page becomes visible (user returns from another tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && session?.user?.id) {
        fetchUnreadByContact()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [session?.user?.id, fetchUnreadByContact])

  return {
    unreadByContact,
    isLoading,
    refetch: fetchUnreadByContact
  }
}