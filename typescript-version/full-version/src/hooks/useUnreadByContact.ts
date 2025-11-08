import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthProvider'
import { useSocketNew } from './useSocketNew'
import { useParams } from 'next/navigation'

export const useUnreadByContact = () => {
  const { user, session } = useAuth()
  const { chatSocket: socket } = useSocketNew()
  const { lang: locale } = useParams()
  const [unreadByContact, setUnreadByContact] = useState<{ [contactId: string]: number }>({})
  const [userStatuses, setUserStatuses] = useState<{ [userId: string]: { isOnline: boolean; lastSeen?: string } }>({})
  const [isLoading, setIsLoading] = useState(false)

  // Function to play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio(`/${locale}/new_message_codeweber.wav`)
      audio.volume = 0.2
      audio.play().catch(() => {})
    } catch (err) {
      // Error handling
    }
  }, [locale])

  // Function to fetch unread messages count by contact from API
  const fetchUnreadByContact = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)
      const response = await fetch('/api/chat/unread-by-contact')
      if (response.ok) {
        const data = await response.json()
        setUnreadByContact(data.unreadByContact || {})
        setUserStatuses(data.userStatuses || {})
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
      fetchUnreadByContact()
    }
  }, [user?.id, fetchUnreadByContact])

  // Listen for real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = () => {
      fetchUnreadByContact()
      playNotificationSound()
    }

    const handleMessagesRead = () => {
      fetchUnreadByContact()
    }

    socket.on('receiveMessage', handleNewMessage)
    socket.on('messagesRead', handleMessagesRead)

    return () => {
      socket.off('receiveMessage', handleNewMessage)
      socket.off('messagesRead', handleMessagesRead)
    }
  }, [socket, fetchUnreadByContact, playNotificationSound])

  // Periodic refresh every 60 seconds as fallback
  useEffect(() => {
    const interval = setInterval(() => {
      if (user?.id && !isLoading) {
        fetchUnreadByContact()
      }
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [user?.id, isLoading, fetchUnreadByContact])

  // Update when window gets focus
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id) {
        fetchUnreadByContact()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [user?.id, fetchUnreadByContact])

  // Update when page becomes visible (user returns from another tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.id) {
        fetchUnreadByContact()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user?.id, fetchUnreadByContact])

  return {
    unreadByContact,
    userStatuses,
    isLoading,
    refetch: fetchUnreadByContact
  }
}
