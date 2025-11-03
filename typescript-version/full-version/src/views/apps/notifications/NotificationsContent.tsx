// React Imports
import { useState, useEffect } from 'react'

// Type Imports
import type { AppDispatch } from '@/redux-store'
import type { NotificationState } from '@/types/apps/notificationTypes'

// Slice Imports
import { updateNotificationStatus, deleteNotification, markAllAsRead, setCurrentNotification } from '@/redux-store/slices/notifications'

// Component Imports
import NotificationsSearch from './NotificationsSearch'
import NotificationsActions from './NotificationsActions'
import NotificationsList from './NotificationsList'
import NotificationDetails from './NotificationDetails'

type Props = {
  store: NotificationState
  dispatch: AppDispatch
  status?: string
  type?: string
  isInitialMount: boolean
  setSidebarOpen: (value: boolean) => void
  isBelowLgScreen: boolean
  isBelowMdScreen: boolean
  isBelowSmScreen: boolean
  setBackdropOpen: (value: boolean) => void
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
    setBackdropOpen
  } = props

  // States
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [reload, setReload] = useState(false)

  // Vars
  const notifications = store.filteredNotifications
  const currentNotification = notifications.find(notification => notification.id === store.currentNotificationId) ||
    // If current notification is not in filtered list, find it in all notifications
    store.notifications.find(notification => notification.id === store.currentNotificationId)


  // Check if filtered notifications are none (including search)
  const areFilteredNotificationsNone =
    notifications.length === 0 ||
    notifications.filter(
      notification =>
        notification.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.message?.toLowerCase().includes(searchTerm.toLowerCase())
    ).length === 0

  // Action for marking single notification as read
  const handleSingleNotificationRead = (notificationId: string) => {
    dispatch(updateNotificationStatus({ notificationId, status: 'read' }))
  }

  // Action for archiving single notification
  const handleSingleNotificationArchive = (notificationId: string) => {
    dispatch(updateNotificationStatus({ notificationId, status: 'archived' }))
  }

  // Action for opening notification details
  const handleNotificationClick = (notificationId: string) => {
    dispatch(setCurrentNotification(notificationId))
    setDrawerOpen(true)
  }

  return (
    <div className='flex flex-col items-center justify-center is-full bs-full relative overflow-hidden bg-backgroundPaper'>
      <NotificationsSearch
        isBelowScreen={isBelowMdScreen}
        searchTerm={searchTerm}
        setSidebarOpen={setSidebarOpen}
        setBackdropOpen={setBackdropOpen}
        setSearchTerm={setSearchTerm}
        dispatch={dispatch}
      />
      <NotificationsActions
        areFilteredNotificationsNone={areFilteredNotificationsNone}
        selectedNotifications={selectedNotifications}
        setSelectedNotifications={setSelectedNotifications}
        notifications={notifications}
        dispatch={dispatch}
        status={status}
        type={type}
        setReload={setReload}
      />
      <NotificationsList
        isInitialMount={isInitialMount}
        isBelowSmScreen={isBelowSmScreen}
        isBelowLgScreen={isBelowLgScreen}
        reload={reload}
        searchTerm={searchTerm}
        selectedNotifications={selectedNotifications}
        setSelectedNotifications={setSelectedNotifications}
        notifications={notifications}
        dispatch={dispatch}
        status={status}
        type={type}
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