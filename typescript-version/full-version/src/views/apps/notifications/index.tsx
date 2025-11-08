'use client'

// React Imports
import { useEffect, useRef, useState } from 'react'

// MUI Imports
import { useMediaQuery } from '@mui/material'
import Backdrop from '@mui/material/Backdrop'
import type { Theme } from '@mui/material/styles'

// Third-party Imports
import classnames from 'classnames'

// Redux Imports
import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from '@/redux-store'

// Slice Imports
import { setNotifications, filterNotifications } from '@/redux-store/slices/notifications'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'
import { useNotifications } from '@/hooks/useNotifications'

// Util Imports
import { commonLayoutClasses } from '@layouts/utils/layoutClasses'

// Component Imports
import SidebarLeft from './SidebarLeft'
import NotificationsContent from './NotificationsContent'

const NotificationsWrapper = ({ status, type }: { status?: string; type?: string }) => {

  // States
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [backdropOpen, setBackdropOpen] = useState(false)

  // Refs
  const isInitialMount = useRef(true)

  // Hooks
  const { settings } = useSettings()
  const dispatch = useDispatch<AppDispatch>()
  const notificationsStore = useSelector((state: RootState) => state.notificationsReducer)
  const { notifications: apiNotifications } = useNotifications()
  const isBelowLgScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'))
  const isBelowMdScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'))
  const isBelowSmScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'))

  // Load notifications on mount (use fresh notifications without localStorage filtering)
  useEffect(() => {
    // Force refresh of notifications to get latest data without localStorage filtering
    const refreshNotifications = async () => {
      try {
        const response = await fetch('/api/notifications')
        if (response.ok) {
          const data = await response.json()
          const mappedNotifications = (data.notifications || []).map((notification: any) => ({
            id: notification.id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            status: notification.status,
            createdAt: notification.createdAt,
            updatedAt: notification.updatedAt,
            userId: notification.userId,
            subtitle: notification.subtitle || notification.message,
            time: notification.time || new Date(notification.createdAt).toLocaleString(),
            read: notification.read !== undefined ? notification.read : notification.status === 'read',
            avatarImage: notification.avatarImage,
            avatarIcon: notification.avatarIcon,
            avatarText: notification.avatarText,
            avatarColor: notification.avatarColor,
            avatarSkin: notification.avatarSkin,
          }))

          // Update Redux store with fresh data (no localStorage filtering)
          dispatch(setNotifications(mappedNotifications))
        }
      } catch (error) {
        console.error('Error refreshing notifications:', error)
      }
    }

    refreshNotifications()
  }, [dispatch])

  // Filter notifications when status or type changes
  useEffect(() => {
    dispatch(filterNotifications({
      notifications: notificationsStore.notifications,
      status: status || undefined,
      type: type || undefined
    }))
  }, [notificationsStore.notifications, status, type, dispatch])

  // Set loading false on initial mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
    }
  }, [])

  // Hide backdrop when left sidebar is closed
  useEffect(() => {
    if (backdropOpen && !sidebarOpen) {
      setBackdropOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarOpen])

  // Hide backdrop when screen size is above md
  useEffect(() => {
    if (backdropOpen && !isBelowMdScreen) {
      setBackdropOpen(false)
    }

    if (sidebarOpen && !isBelowMdScreen) {
      setSidebarOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBelowMdScreen])

  return (
    <div
      className={classnames(commonLayoutClasses.contentHeightFixed, 'flex is-full overflow-hidden rounded relative', {
        border: settings.skin === 'bordered',
        'shadow-md': settings.skin !== 'bordered'
      })}
    >
      <SidebarLeft
        isBelowLgScreen={isBelowLgScreen}
        isBelowMdScreen={isBelowMdScreen}
        isBelowSmScreen={isBelowSmScreen}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        status={status}
        type={type}
      />
      <Backdrop open={backdropOpen} onClick={() => setBackdropOpen(false)} className='absolute z-10' />
      <NotificationsContent
        store={notificationsStore}
        dispatch={dispatch}
        status={status}
        type={type}
        isInitialMount={isInitialMount.current}
        setSidebarOpen={setSidebarOpen}
        isBelowLgScreen={isBelowLgScreen}
        isBelowMdScreen={isBelowMdScreen}
        isBelowSmScreen={isBelowSmScreen}
        setBackdropOpen={setBackdropOpen}
      />
    </div>
  )
}

export default NotificationsWrapper