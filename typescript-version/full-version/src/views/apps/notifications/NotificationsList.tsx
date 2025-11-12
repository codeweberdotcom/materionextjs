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
import Skeleton from '@mui/material/Skeleton'

import type { Notification, NotificationStatus } from '@/types/apps/notificationTypes'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Util Imports
import { getInitials } from '@/utils/formatting/getInitials'
import { formatNotificationTimestamp, normalizeAvatarSkin, normalizeThemeColor } from '@/utils/notifications/helpers'

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

  const getAvatar = (notification: Notification) => {
    const color = normalizeThemeColor(notification.avatarColor) || 'primary'
    const skin = normalizeAvatarSkin(notification.avatarSkin) || 'light-static'

    if (notification.avatarImage) {
      return <CustomAvatar src={notification.avatarImage} skin={skin} />
    }

    if (notification.avatarIcon) {
      return (
        <CustomAvatar color={color} skin={skin}>
          <i className={notification.avatarIcon} />
        </CustomAvatar>
      )
    }

    return (
      <CustomAvatar color={color} skin={skin}>
        {notification.avatarText || getInitials(notification.title || 'N')}
      </CustomAvatar>
    )
  }

  const getStatusColor = (status: NotificationStatus) => {
    switch (status) {
      case 'unread': return 'primary'
      case 'read': return 'secondary'
      case 'archived': return 'error'
      default: return 'default'
    }
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
                    <Skeleton variant='circular' width={40} height={40} />
                    <div className='flex gap-4 justify-between items-center overflow-hidden'>
                      <Skeleton variant='rectangular' width={150} height={20} />
                    </div>
                  </div>
                  {!isBelowSmScreen && (
                    <div className='flex items-center gap-2'>
                      <Skeleton variant='rectangular' width={100} height={16} />
                      <Skeleton variant='rectangular' width={60} height={24} />
                      <Skeleton variant='rectangular' width={20} height={20} />
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

  if (searchFilteredNotifications.length === 0) {
    return (
      <div className='relative flex justify-center gap-2 grow is-full'>
        <Typography color='text.primary' className='m-3'>
          {dictionary.navigation.noNotificationsFound}
        </Typography>
      </div>
    )
  }

  return (
    <div className='relative overflow-hidden grow is-full'>
      <ScrollWrapper isBelowLgScreen={isBelowLgScreen}>
        <div className='flex flex-col'>
          {searchFilteredNotifications.map((notification: Notification, index: number) => {
            const isSelected = selectedNotifications.has(notification.id)
            const timestampLabel =
              formatNotificationTimestamp(notification.createdAt) ?? dictionary.navigation.justNow ?? 'Just now'

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
                        onChange={event => handleSelectNotification(notification.id, event.target.checked)}
                        onClick={event => event.stopPropagation()}
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
                      <div className='flex items-center gap-2' />
                      <Typography variant='body2' color='text.disabled' className='whitespace-nowrap'>
                        {timestampLabel}
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
