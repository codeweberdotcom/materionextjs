'use client'

import { useEffect, useRef } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import { useAuth } from '@/contexts/AuthProvider'

const NotificationsInitializer = () => {
  const { user } = useAuth()
  const { refresh } = useNotifications()
  const lastUserIdRef = useRef<string | undefined>()

  useEffect(() => {
    if (!user?.id) {
      lastUserIdRef.current = undefined
      return
    }

    if (lastUserIdRef.current === user.id) {
      return
    }

    lastUserIdRef.current = user.id
    refresh()
  }, [refresh, user?.id])

  return null
}

export default NotificationsInitializer
