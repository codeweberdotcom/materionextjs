// React Imports
import type { Dispatch, MouseEvent, ReactNode, SetStateAction } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'

// Third-party Imports
import classnames from 'classnames'
import PerfectScrollbar from 'react-perfect-scrollbar'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import type { Notification } from '@/types/apps/notificationTypes'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Util Imports
import { getInitials } from '@/utils/formatting/getInitials'

// Hook Imports
import { useTranslation } from '@/contexts/TranslationContext'
import { usePermissions } from '@/hooks/usePermissions'

// Styles Imports
import styles from './styles.module.css'

type Props = {
   isInitialMount: boolean
   isBelowSmScreen: boolean
   isBelowLgScreen: boolean
   reload: boolean
   filtering: boolean
   loading: boolean
   searchTerm: string
   selectedNotifications: Set<string>
   setSelectedNotifications: Dispatch<SetStateAction<Set<string>>>
   notifications: Notification[]
   status?: string
   type?: string
   handleSingleNotificationRead: (notificationId: string) => void
   handleSingleNotificationArchive: (notificationId: string) => void
   handleNotificationClick: (notificationId: string) => void
}

const ScrollWrapper = ({ children, isBelowLgScreen }: { children: ReactNode; isBelowLgScreen: boolean }) => {
  if (isBelowLgScreen) {
    return <div className='bs-full overflow-y-auto overflow-x-hidden relative'>{children}</div>
  } else {
    return <PerfectScrollbar options={{ wheelPropagation: false }}>{children}</PerfectScrollbar>
  }
}

const NotificationsList = (props: Props) => {
  // Props
   const {
     isInitialMount,
     isBelowSmScreen,
     isBelowLgScreen,
     reload,
     filtering,
     loading,
     searchTerm,
     selectedNotifications,
     setSelectedNotifications,
     notifications,
     status,
     type,
     handleSingleNotificationRead,
     handleSingleNotificationArchive,
     handleNotificationClick
   } = props

  // Hooks
  const dictionary = useTranslation()
  const { checkPermission } = usePermissions()

  // Filter notifications based on search term (status and type filtering is done in Redux)
  const searchFilteredNotifications = notifications.filter(notification =>
    notification.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notification.message?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelectNotification = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedNotifications)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedNotifications(newSelected)
  }

  const handleMarkAsRead = (id: string) => {
    handleSingleNotificationRead(id)
  }

  const handleArchive = (id: string) => {
    handleSingleNotificationArchive(id)
  }

  const getAvatar = (notification: any) => {
    if (notification.avatarIcon) {
      return (
        <CustomAvatar color={notification.avatarColor || 'primary'} skin='light-static'>
          <i className={notification.avatarIcon} />
        </CustomAvatar>
      )
    }

    return (
      <CustomAvatar color={notification.avatarColor || 'primary'} skin='light-static'>
        {getInitials(notification.title || 'N')}
      </CustomAvatar>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unread': return 'primary'
      case 'read': return 'secondary'
      case 'archived': return 'error'
      default: return 'default'
    }
  }

  if (searchFilteredNotifications.length === 0 && !isInitialMount) {
    return (
      <div className='relative flex justify-center gap-2 grow is-full'>
        <Typography color='text.primary' className='m-3'>
          {dictionary.navigation.noNotificationsFound}
        </Typography>
      </div>
    )
  }

  // Show skeleton loading during initial mount, reload, filtering, or loading
  if (isInitialMount || reload || filtering || loading) {
    return (
      <div className='relative overflow-hidden grow is-full'>
        <ScrollWrapper isBelowLgScreen={isBelowLgScreen}>
          <div className='flex flex-col'>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`skeleton-${index}`} className='p-4'>
                <div className='flex items-center justify-between gap-2'>
                  <div className='flex items-center gap-2 overflow-hidden'>
                    <Skeleton circle width={40} height={40} />
                    <div className='flex gap-4 justify-between items-center overflow-hidden'>
                      <Skeleton width={150} height={20} />
                    </div>
                  </div>
                  {!isBelowSmScreen && (
                    <div className='flex items-center gap-2'>
                      <Skeleton width={100} height={16} />
                      <Skeleton width={60} height={24} />
                      <Skeleton width={20} height={20} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollWrapper>
      </div>
    )
  }

  return (
    <div className='relative overflow-hidden grow is-full'>
      <ScrollWrapper isBelowLgScreen={isBelowLgScreen}>
        <div className='flex flex-col'>
          {searchFilteredNotifications.map((notification: Notification, index: number) => {
            const notif = notification as any
            const isSelected = selectedNotifications.has(notif.id)

            return (
              <div
                key={notification.id || index}
                className={classnames('p-4 cursor-pointer', styles.notificationList, { 'bg-actionHover': notification.status === 'read' })}
                onClick={() => handleNotificationClick(notification.id)}
              >
                <div className='flex items-center justify-between gap-2'>
                  <div className='flex items-center gap-2 overflow-hidden'>
                    {checkPermission('notifications', 'delete') && (
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => handleSelectNotification(notification.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    {getAvatar(notification)}
                    <div className='flex gap-4 justify-between items-center overflow-hidden'>
                      <Typography color='text.primary' className='font-medium whitespace-nowrap'>
                        {notification.title}
                      </Typography>
                    </div>
                  </div>
                  {!isBelowSmScreen && (
                    <div
                      className={classnames('flex items-center gap-2', styles.notificationInfo)}
                    >
                      <div className='flex items-center gap-2'>
                      </div>
                      <Typography variant='body2' color='text.disabled' className='whitespace-nowrap'>
                        {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Just now'}
                      </Typography>
                      {notification.type && (
                        <Chip
                          label={dictionary.navigation[notification.type] || notification.type}
                          size='small'
                          variant='outlined'
                        />
                      )}
                      <i
                        className={classnames(
                          'text-lg ml-2',
                          notification.status === 'unread' ? 'ri-mail-unread-line text-primary' : 'ri-mail-open-line text-secondary'
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollWrapper>
    </div>
  )
}

export default NotificationsList
