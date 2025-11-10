'use client'

// React Imports
import { useRef, useState, useEffect } from 'react'
import type { MouseEvent, ReactNode } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'

// MUI Imports
import IconButton from '@mui/material/IconButton'
import Badge from '@mui/material/Badge'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import useMediaQuery from '@mui/material/useMediaQuery'
import Button from '@mui/material/Button'
import type { Theme } from '@mui/material/styles'

// Third Party Components
import classnames from 'classnames'
import PerfectScrollbar from 'react-perfect-scrollbar'

// Type Imports
import type { ThemeColor } from '@core/types'
import type { CustomAvatarProps } from '@core/components/mui/Avatar'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'
import { useNotifications } from '@/hooks/useNotifications'
import { useTranslation } from '@/contexts/TranslationContext'

// Util Imports
import { getInitials } from '@/utils/formatting/getInitials'

export type NotificationsType = {
  title: string
  subtitle: string
  time: string
  read: boolean
} & (
  | {
      avatarImage?: string
      avatarIcon?: never
      avatarText?: never
      avatarColor?: never
      avatarSkin?: never
    }
  | {
      avatarIcon?: string
      avatarColor?: ThemeColor
      avatarSkin?: CustomAvatarProps['skin']
      avatarImage?: never
      avatarText?: never
    }
  | {
      avatarText?: string
      avatarColor?: ThemeColor
      avatarSkin?: CustomAvatarProps['skin']
      avatarImage?: never
      avatarIcon?: never
    }
)

const ScrollWrapper = ({ children, hidden }: { children: ReactNode; hidden: boolean }) => {
  if (hidden) {
    return <div className='overflow-x-hidden bs-full'>{children}</div>
  } else {
    return (
      <PerfectScrollbar className='bs-full' options={{ wheelPropagation: false, suppressScrollX: true }}>
        {children}
      </PerfectScrollbar>
    )
  }
}

const getAvatar = (
  params: Pick<NotificationsType, 'avatarImage' | 'avatarIcon' | 'title' | 'avatarText' | 'avatarColor' | 'avatarSkin'>
) => {
  const { avatarImage, avatarIcon, avatarText, title, avatarColor, avatarSkin } = params

  if (avatarImage) {
    return <Avatar src={avatarImage} />
  } else if (avatarIcon) {
    return (
      <CustomAvatar color={avatarColor} skin={avatarSkin || 'light-static'}>
        <i className={avatarIcon} />
      </CustomAvatar>
    )
  } else {
    return (
      <CustomAvatar color={avatarColor} skin={avatarSkin || 'light-static'}>
        {avatarText || getInitials(title)}
      </CustomAvatar>
    )
  }
}

const NotificationDropdown = ({ notifications: staticNotifications }: { notifications: NotificationsType[] }) => {
  // Hooks
  const { notifications, loading, unreadCount, markAsRead, removeNotification, clearAllNotifications, updateStatus } = useNotifications()
  const router = useRouter()
  const dictionary = useTranslation()

  // States
  const [open, setOpen] = useState(false)

  // Filter out archived/deleted notifications for dropdown display
  const visibleNotifications = notifications.filter(
    notification => (notification as any).status !== 'archived' && (notification as any).status !== 'deleted'
  )

  // Use dynamic notifications if available, fallback to static
  const notificationsState = visibleNotifications.length > 0 ? visibleNotifications : staticNotifications

  // Vars
  const notificationCount = unreadCount || notificationsState.filter(notification => (notification as any).status !== 'read' && (notification as any).status !== 'archived' && (notification as any).status !== 'deleted').length
  const readAll = notificationsState.every(notification => (notification as any).status === 'read' || (notification as any).status === 'archived')

  // Refs
  const anchorRef = useRef<HTMLButtonElement>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  // Hooks
  const hidden = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'))
  const isSmallScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'))
  const { settings } = useSettings()

  const handleClose = () => {
    setOpen(false)
  }

  const handleToggle = () => {
    setOpen(prevOpen => !prevOpen)
  }

  // Read notification when notification is clicked
  const handleReadNotification = async (event: MouseEvent<HTMLElement>, value: boolean, index: number) => {
    event.stopPropagation()
    const notification = notificationsState[index]

    // Skip virtual chat notifications - they can't be marked as read through API
    if (notification && (notification as any).id && !(notification as any).id.startsWith('virtual-')) {
      await markAsRead((notification as any).id, value)
    }
  }

  // Archive notification when close icon is clicked
  const handleArchiveNotification = async (event: MouseEvent<HTMLElement>, index: number) => {
    event.stopPropagation()
    const notification = notificationsState[index]

    // Skip virtual chat notifications - they can't be archived through API
    if (notification && (notification as any).id) {
      await updateStatus((notification as any).id, 'archived')
    }
  }

  // Archive notification when close icon is clicked
  const handleRemoveNotification = async (event: MouseEvent<HTMLElement>, index: number) => {
    event.stopPropagation()
    const notification = notificationsState[index]

    // Skip virtual chat notifications - they can't be archived through API
    if (notification && (notification as any).id && !(notification as any).id.startsWith('virtual-')) {
      await handleArchiveNotification(event, index)
    }
  }

  // Clear all notifications when read all icon is clicked (only for dropdown)
  const readAllNotifications = async () => {
    await clearAllNotifications()
  }

  useEffect(() => {
    const adjustPopoverHeight = () => {
      if (ref.current) {
        // Calculate available height, subtracting any fixed UI elements' height as necessary
        const availableHeight = window.innerHeight - 100

        ref.current.style.height = `${Math.min(availableHeight, 550)}px`
      }
    }

    window.addEventListener('resize', adjustPopoverHeight)
  }, [])

  return (
    <>
      <IconButton ref={anchorRef} onClick={handleToggle} className='!text-textPrimary'>
        <Badge
          color='error'
          className='cursor-pointer'
          variant='dot'
          overlap='circular'
          invisible={notificationCount === 0}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <i className='ri-notification-2-line' />
        </Badge>
      </IconButton>
      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-end'
        ref={ref}
        anchorEl={anchorRef.current}
        {...(isSmallScreen
          ? {
              className: 'is-full !mbs-4 z-[1] max-bs-[550px] bs-[550px]',
              modifiers: [
                {
                  name: 'preventOverflow',
                  options: {
                    padding: themeConfig.layoutPadding
                  }
                }
              ]
            }
          : { className: 'is-96 !mbs-4 z-[1] max-bs-[550px] bs-[550px]' })}
      >
        {({ TransitionProps, placement }) => (
          <Fade {...TransitionProps} style={{ transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top' }}>
            <Paper className={classnames('bs-full', settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg')}>
              <ClickAwayListener onClickAway={handleClose}>
                <div className='bs-full flex flex-col'>
                  <div className='flex items-center justify-between plb-2 pli-4 is-full gap-4'>
                    <Typography variant='h5' className='flex-auto'>
                      {dictionary.navigation.notifications}
                    </Typography>
                    {notificationCount > 0 && (
                      <Chip size='small' variant='tonal' color='primary' label={`${notificationCount} New`} />
                    )}
                    {notificationsState.length > 0 && (
                      <Tooltip
                        title={dictionary.navigation.clearAllNotifications || 'Clear all notifications'}
                        placement={placement === 'bottom-end' ? 'left' : 'right'}
                        slotProps={{
                          popper: {
                            sx: {
                              '& .MuiTooltip-tooltip': {
                                transformOrigin:
                                  placement === 'bottom-end' ? 'right center !important' : 'right center !important'
                              }
                            }
                          }
                        }}
                      >
                        <IconButton size='small' onClick={() => readAllNotifications()} className='text-textPrimary'>
                          <i className='ri-delete-bin-7-line' />
                        </IconButton>
                      </Tooltip>
                    )}
                  </div>
                  <Divider />
                  <ScrollWrapper hidden={hidden}>
                    {notificationsState.map((notification, index) => {
                      const {
                        title,
                        subtitle,
                        time,
                        read,
                        avatarImage,
                        avatarIcon,
                        avatarText,
                        avatarColor,
                        avatarSkin
                      } = notification

                      return (
                        <div
                          key={index}
                          className={classnames('flex plb-3 pli-4 gap-3 cursor-pointer hover:bg-actionHover group', {
                            'border-be': index !== notificationsState.length - 1
                          })}
                          onMouseEnter={() => {
                            // Removed auto-mark as read on hover functionality
                          }}
                          onClick={e => {
                            // Handle virtual chat notification click
                            if ((notification as any).id?.startsWith('virtual-')) {
                              router.push('/en/apps/chat')
                              setOpen(false)
                            } else {
                              handleReadNotification(e, true, index)
                            }
                          }}
                        >
                          {getAvatar({ avatarImage, avatarIcon, title, avatarText, avatarColor, avatarSkin })}
                          <div className='flex flex-col flex-auto'>
                            <Typography className='font-medium mbe-1' color='text.primary'>
                              {title}
                            </Typography>
                            <Typography variant='caption' color='text.secondary' className='mbe-2'>
                              {subtitle}
                            </Typography>
                            <Typography variant='caption'>{time}</Typography>
                          </div>
                          <div className='flex flex-col items-end gap-2.5'>
                            <Badge
                              variant='dot'
                              color={
                                (notification as any).id?.startsWith('virtual-')
                                  ? 'error' // Красная точка для виртуальных уведомлений чата
                                  : (notification as any).status === 'read'
                                  ? 'secondary' // Серая точка для прочитанных уведомлений из БД
                                  : 'primary' // Фиолетовая точка для непрочитанных уведомлений из БД
                              }
                              className={classnames('mbs-1 mie-1', {
                                'invisible group-hover:visible': (notification as any).status === 'read' && !(notification as any).id?.startsWith('virtual-')
                              })}
                            />
                            {!(notification as any).id?.startsWith('virtual-') && (
                              <IconButton
                                size='small'
                                className='invisible group-hover:visible p-0'
                                onClick={e => handleRemoveNotification(e, index)}
                              >
                                <i className='ri-close-line text-xl text-textSecondary' />
                              </IconButton>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </ScrollWrapper>
                  <Divider />
                  <div className='p-4'>
                    <Button
                      fullWidth
                      variant='contained'
                      size='small'
                      onClick={() => {
                        router.push('/en/apps/notifications')
                        setOpen(false)
                      }}
                    >
                      {dictionary.navigation.viewAllNotifications || 'View All Notifications'}
                    </Button>
                  </div>
                </div>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

export default NotificationDropdown
