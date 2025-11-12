// MUI Imports
import Checkbox from '@mui/material/Checkbox'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'

import { useTranslation } from '@/contexts/TranslationContext'
import { usePermissions } from '@/hooks/usePermissions'
import type { Notification } from '@/types/apps/notificationTypes'

type Props = {
  areFilteredNotificationsNone: boolean
  selectedNotifications: Set<string>
  setSelectedNotifications: (value: Set<string>) => void
  notifications: Notification[]
  setReload: (value: boolean) => void
  onArchive: (notificationId: string) => void
  onRefresh: (reason?: string) => void
}

const NotificationsActions = (props: Props) => {
  // Props
  const {
    areFilteredNotificationsNone,
    selectedNotifications,
    setSelectedNotifications,
    notifications,
    setReload,
    onArchive,
    onRefresh
  } = props

  // Hooks
  const dictionary = useTranslation()
  const { checkPermission } = usePermissions()

  // Vars
  const areAllSelected = selectedNotifications.size > 0 && selectedNotifications.size === notifications.length
  const isIndeterminate = selectedNotifications.size > 0 && selectedNotifications.size < notifications.length

  // Toggle all notifications' selection
  const handleSelectAllCheckboxes = () => {
    if (areAllSelected) {
      setSelectedNotifications(new Set())
    } else {
      const visibleNotificationIds = new Set(notifications.map(notification => notification.id))
      setSelectedNotifications(visibleNotificationIds)
    }
  }

  // Archive selected notifications
  const handleArchive = () => {
    for (const id of selectedNotifications) {
      onArchive(id)
    }
    setSelectedNotifications(new Set())
  }

  return (
    <div className='flex items-center justify-between gap-4 max-sm:gap-0.5 is-full pli-4 plb-2 border-be'>
      {checkPermission('notifications', 'delete') && (
        <div className='flex items-center gap-1 max-sm:gap-0.5'>
          <Checkbox
            indeterminate={isIndeterminate}
            checked={areAllSelected}
            onChange={handleSelectAllCheckboxes}
            disabled={areFilteredNotificationsNone}
          />
          {(isIndeterminate || areAllSelected) && (
            <>
              <Tooltip title={dictionary.navigation.trash} placement='top'>
                <IconButton onClick={handleArchive}>
                  <i className='ri-delete-bin-line text-textSecondary' />
                </IconButton>
              </Tooltip>
            </>
          )}
        </div>
      )}
      <div className='flex gap-1 max-sm:gap-0.5'>
        <Tooltip title={dictionary.navigation.refresh} placement='top'>
          <IconButton onClick={() => {
            setReload(true)
            Promise.resolve(onRefresh('toolbar')).finally(() => {
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
