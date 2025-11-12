import { useState, useEffect, useCallback } from 'react'

import type { AppDispatch } from '@/redux-store'
import type {
  NotificationState,
  NotificationStatus,
  NotificationStatusFilter,
  NotificationTypeFilter
} from '@/types/apps/notificationTypes'

import { setCurrentNotification } from '@/redux-store/slices/notifications'

// Component Imports
import NotificationsSearch from './NotificationsSearch'
import NotificationsActions from './NotificationsActions'
import NotificationsList from './NotificationsList'
import NotificationDetails from './NotificationDetails'

type Props = {
  store: NotificationState
  dispatch: AppDispatch
  status?: NotificationStatusFilter
  type?: NotificationTypeFilter
  isInitialMount: boolean
  setSidebarOpen: (value: boolean) => void
  isBelowLgScreen: boolean
  isBelowMdScreen: boolean
  isBelowSmScreen: boolean
  setBackdropOpen: (value: boolean) => void
  onMarkAsRead: (notificationId: string, read?: boolean) => void
  onUpdateStatus: (notificationId: string, status: NotificationStatus) => void
  onRefresh: (reason?: string) => void
}

const NotificationsContent = (props: Props) => {
  // Props
  const {
    store,
    dispatch,
    status,
    type,
    isInitialMount,
    setSidebarOpen,
    isBelowLgScreen,
    isBelowMdScreen,
    isBelowSmScreen,
    setBackdropOpen,
    onMarkAsRead,
    onUpdateStatus,
    onRefresh
  } = props

  // States
   const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
   const [drawerOpen, setDrawerOpen] = useState(false)
   const [searchTerm, setSearchTerm] = useState('')
   const [reload, setReload] = useState(false)
   const [filtering, setFiltering] = useState(false)

  // Vars
  const notifications = store.filteredNotifications
  const isLoading = store.loading
  const currentNotification = notifications.find(notification => notification.id === store.currentNotificationId) ||
    // If current notification is not in filtered list, find it in all notifications
    store.notifications.find(notification => notification.id === store.currentNotificationId)


  // Check if filtered notifications are none (including search)
  const areFilteredNotificationsNone =
    !isLoading &&
    (notifications.length === 0 ||
      notifications.filter(
        notification =>
          notification.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          notification.message?.toLowerCase().includes(searchTerm.toLowerCase())
      ).length === 0)

  // Action for marking single notification as read
  const handleSingleNotificationRead = useCallback(
    (notificationId: string) => {
      onMarkAsRead(notificationId, true)
    },
    [onMarkAsRead]
  )

  const handleSingleNotificationArchive = useCallback(
    (notificationId: string) => {
      onUpdateStatus(notificationId, 'archived')
    },
    [onUpdateStatus]
  )

  // Action for opening notification details
  const handleNotificationClick = useCallback((notificationId: string) => {
    dispatch(setCurrentNotification(notificationId))
    setDrawerOpen(true)
  }, [dispatch])

  const handleRefresh = useCallback(
    (reason?: string) => {
      onRefresh(reason)
    },
    [onRefresh]
  )

  // Handle filtering state
  useEffect(() => {
    if (status !== undefined || type !== undefined) {
      setFiltering(true)
      // Simulate filtering delay for better UX
      const timer = setTimeout(() => {
        setFiltering(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [status, type])

  return (
    <div className='flex flex-col items-center justify-center is-full bs-full relative overflow-hidden bg-backgroundPaper'>
      <NotificationsSearch
        isBelowScreen={isBelowMdScreen}
        searchTerm={searchTerm}
        setSidebarOpen={setSidebarOpen}
        setBackdropOpen={setBackdropOpen}
        setSearchTerm={setSearchTerm}
        onRefresh={handleRefresh}
      />
      <NotificationsActions
        areFilteredNotificationsNone={areFilteredNotificationsNone}
        selectedNotifications={selectedNotifications}
        setSelectedNotifications={setSelectedNotifications}
        notifications={notifications}
        setReload={setReload}
        onArchive={id => onUpdateStatus(id, 'archived')}
        onRefresh={handleRefresh}
      />
      <NotificationsList
        isInitialMount={isInitialMount}
        isBelowSmScreen={isBelowSmScreen}
        isBelowLgScreen={isBelowLgScreen}
        reload={reload}
        filtering={filtering}
        loading={isLoading}
        searchTerm={searchTerm}
        selectedNotifications={selectedNotifications}
        setSelectedNotifications={setSelectedNotifications}
        notifications={notifications}
        handleSingleNotificationRead={handleSingleNotificationRead}
        handleSingleNotificationArchive={handleSingleNotificationArchive}
        handleNotificationClick={handleNotificationClick}
      />
      <NotificationDetails
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        currentNotification={currentNotification}
        isBelowSmScreen={isBelowSmScreen}
        isBelowLgScreen={isBelowLgScreen}
        notifications={notifications}
        dispatch={dispatch}
        handleSingleNotificationRead={handleSingleNotificationRead}
        handleSingleNotificationArchive={handleSingleNotificationArchive}
      />
    </div>
  )
}

export default NotificationsContent
