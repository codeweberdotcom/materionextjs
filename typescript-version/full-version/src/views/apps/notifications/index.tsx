'use client'

// React Imports
import { useEffect, useRef, useState, useCallback } from 'react'

// MUI Imports
import { useMediaQuery } from '@mui/material'
import Backdrop from '@mui/material/Backdrop'
import type { Theme } from '@mui/material/styles'

// Third-party Imports
import classnames from 'classnames'

// Redux Imports
import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from '@/redux-store'
import type { NotificationStatusFilter, NotificationTypeFilter } from '@/types/apps/notificationTypes'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'
import { useNotifications } from '@/hooks/useNotifications'

// Util Imports
import { commonLayoutClasses } from '@layouts/utils/layoutClasses'

// Component Imports
import SidebarLeft from './SidebarLeft'
import NotificationsContent from './NotificationsContent'

const NotificationsWrapper = ({ status, type }: { status?: NotificationStatusFilter; type?: NotificationTypeFilter }) => {

  // States
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [backdropOpen, setBackdropOpen] = useState(false)

  // Refs
  const isInitialMount = useRef(true)

  // Hooks
  const { settings } = useSettings()
  const dispatch = useDispatch<AppDispatch>()
  const notificationsStore = useSelector((state: RootState) => state.notificationsReducer)
  const {
    setFilters: applyNotificationFilters,
    markAsRead,
    updateStatus,
    refresh
  } = useNotifications()
  const isBelowLgScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'))
  const isBelowMdScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'))
  const isBelowSmScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'))

  // Filter notifications when status or type changes
  useEffect(() => {
    applyNotificationFilters({
      status: status || 'all',
      type: type || 'all'
    })
  }, [applyNotificationFilters, status, type])

  const handleRefresh = useCallback(
    (reason?: string) => {
      refresh(reason)
    },
    [refresh]
  )

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
        onMarkAsRead={markAsRead}
        onUpdateStatus={updateStatus}
        onRefresh={handleRefresh}
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
