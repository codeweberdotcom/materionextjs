// MUI Imports
import Checkbox from '@mui/material/Checkbox'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'

// Hook Imports
import { useNotifications } from '@/hooks/useNotifications'

// Type Imports
import type { AppDispatch } from '@/redux-store'

// Slice Imports
import { updateNotificationStatus, deleteNotification, markAllAsRead } from '@/redux-store/slices/notifications'

type Props = {
  areFilteredNotificationsNone: boolean
  selectedNotifications: Set<string>
  setSelectedNotifications: (value: Set<string>) => void
  notifications: any[]
  dispatch: AppDispatch
  status?: string
  type?: string
  setReload: (value: boolean) => void
}

const NotificationsActions = (props: Props) => {
  // Props
  const { areFilteredNotificationsNone, selectedNotifications, setSelectedNotifications, notifications, dispatch, setReload } = props

  // Hooks
  const { refresh } = useNotifications()

  // Vars
  const areAllSelected = selectedNotifications.size > 0 && selectedNotifications.size === notifications.length
  const isIndeterminate = selectedNotifications.size > 0 && selectedNotifications.size < notifications.length

  // Toggle all notifications' selection
  const handleSelectAllCheckboxes = () => {
    if (areAllSelected) {
      setSelectedNotifications(new Set())
    } else {
      const visibleNotificationIds = new Set(notifications.map(notif => (notif as any).id))
      setSelectedNotifications(visibleNotificationIds)
    }
  }

  // Mark selected notifications as read
  const handleMarkAsRead = () => {
    for (const id of selectedNotifications) {
      dispatch(updateNotificationStatus({ notificationId: id, status: 'read' }))
    }
    setSelectedNotifications(new Set())
  }

  // Archive selected notifications
  const handleArchive = () => {
    for (const id of selectedNotifications) {
      dispatch(updateNotificationStatus({ notificationId: id, status: 'trash' }))
    }
    setSelectedNotifications(new Set())
  }

  return (
    <div className='flex items-center justify-between gap-4 max-sm:gap-0.5 is-full pli-4 plb-2 border-be'>
      <div className='flex items-center gap-1 max-sm:gap-0.5'>
        <Checkbox
          indeterminate={isIndeterminate}
          checked={areAllSelected}
          onChange={handleSelectAllCheckboxes}
          disabled={areFilteredNotificationsNone}
        />
        {(isIndeterminate || areAllSelected) && (
          <>
            <Tooltip title='Trash' placement='top'>
              <IconButton onClick={handleArchive}>
                <i className='ri-delete-bin-line text-textSecondary' />
              </IconButton>
            </Tooltip>
          </>
        )}
      </div>
      <div className='flex gap-1 max-sm:gap-0.5'>
        <Tooltip title='Refresh' placement='top'>
          <IconButton onClick={() => {
            setReload(true)
            refresh().finally(() => {
              setTimeout(() => setReload(false), 2000)
            })
          }}>
            <i className='ri-refresh-line text-textSecondary' />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  )
}

export default NotificationsActions