// React Imports
import { useState, useEffect } from 'react'
import type { MouseEvent, ReactNode } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'

// MUI Imports
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import { styled } from '@mui/material'

// Third-party Imports
import classnames from 'classnames'
import PerfectScrollbar from 'react-perfect-scrollbar'

// Types Imports
import type { AppDispatch } from '@/redux-store'
import type { Notification } from '@/types/apps/notificationTypes'

// Slice Imports
import { updateNotificationStatus, navigateNotifications } from '@/redux-store/slices/notifications'

// Components Imports
import CustomIconButton from '@core/components/mui/IconButton'
import DirectionalIcon from '@components/DirectionalIcon'

// Hook Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Styles Imports
import styles from './styles.module.css'

type Props = {
  drawerOpen: boolean
  setDrawerOpen: (value: boolean) => void
  currentNotification?: Notification
  isBelowSmScreen: boolean
  isBelowLgScreen: boolean
  notifications: Notification[]
  dispatch: AppDispatch
  handleSingleNotificationRead: (notificationId: string) => void
  handleSingleNotificationArchive: (notificationId: string) => void
}

const ScrollWrapper = ({ children, isBelowLgScreen }: { children: ReactNode; isBelowLgScreen: boolean }) => {
  if (isBelowLgScreen) {
    return <div className='bs-full overflow-y-auto overflow-x-hidden bg-actionHover'>{children}</div>
  } else {
    return (
      <PerfectScrollbar className='bg-actionHover' options={{ wheelPropagation: false }}>
        {children}
      </PerfectScrollbar>
    )
  }
}

const DetailsDrawer = styled('div')<{ drawerOpen: boolean }>(({ drawerOpen }) => ({
  display: 'flex',
  flexDirection: 'column',
  blockSize: '100%',
  inlineSize: '100%',
  position: 'absolute',
  top: 0,
  right: drawerOpen ? 0 : '-100%',
  zIndex: 11,
  overflow: 'hidden',
  background: 'var(--mui-palette-background-paper)',
  transition: 'right 0.3s ease'
}))

const NotificationDetails = (props: Props) => {
  // Props
  const {
    drawerOpen,
    setDrawerOpen,
    isBelowSmScreen,
    isBelowLgScreen,
    currentNotification,
    notifications,
    dispatch,
    handleSingleNotificationRead,
    handleSingleNotificationArchive,
  } = props

  // States
  const [showReplies, setShowReplies] = useState(false)

  // Hooks
  const router = useRouter()
  const dictionary = useTranslation()

  // Auto-mark as read when drawer opens
  useEffect(() => {
    if (drawerOpen && currentNotification && currentNotification.status === 'unread' && currentNotification.id !== 'virtual-chat-unread') {
      // Call the API directly to update the database
      fetch(`/api/notifications/${currentNotification.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'read' }),
      })
      .then(response => {
        if (response.ok) {
          handleSingleNotificationRead(currentNotification.id)
        }
      })
      .catch(error => {
        console.error('Error auto-marking as read:', error)
      })
    }
  }, [drawerOpen, currentNotification])

  // Handle navigation between notifications and reset reply state
  const handleNotificationNavigation = (type: 'next' | 'prev') => {
    if (currentNotification?.id) {
      dispatch(navigateNotifications({ type, notifications, currentNotificationId: currentNotification.id }))

      if (showReplies) {
        setShowReplies(false)
      }
    }
  }

  // Close drawer and reset reply state
  const handleCloseDrawer = () => {
    setDrawerOpen(false)

    if (showReplies) {
      setShowReplies(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unread': return 'primary'
      case 'read': return 'secondary'
      case 'trash': return 'error'
      default: return 'default'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'system': return 'info'
      case 'user': return 'success'
      case 'security': return 'warning'
      case 'marketing': return 'secondary'
      case 'info': return 'primary'
      case 'chat': return 'success'
      default: return 'default'
    }
  }

  // Handle chat navigation for virtual chat notifications
  const handleGoToChat = () => {
    router.push('/en/apps/chat')
    setDrawerOpen(false)
  }


  return (
    <DetailsDrawer drawerOpen={drawerOpen}>
      {currentNotification && (
        <>
          <div className='plb-4 pli-5'>
            <div className='flex justify-between gap-2'>
              <div className='flex gap-2 items-center overflow-hidden'>
                <IconButton onClick={handleCloseDrawer}>
                  <DirectionalIcon
                    ltrIconClass='ri-arrow-left-s-line'
                    rtlIconClass='ri-arrow-right-s-line'
                    className='text-textPrimary'
                  />
                </IconButton>
                <div className='flex items-center flex-wrap gap-2 overflow-hidden'>
                  <Typography color='text.primary' noWrap>
                    {currentNotification.title}
                  </Typography>
                  <div className='flex items-center flex-wrap gap-2'>
                    {currentNotification.type && (
                      <Chip
                        label={dictionary.navigation[currentNotification.type] || currentNotification.type}
                        size='small'
                        variant='outlined'
                        color={getTypeColor(currentNotification.type)}
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <IconButton disabled={!currentNotification.id || currentNotification.id === notifications[0]?.id} onClick={() => handleNotificationNavigation('prev')}>
                  <DirectionalIcon
                    ltrIconClass='ri-arrow-left-s-line'
                    rtlIconClass='ri-arrow-right-s-line'
                    className='text-textSecondary'
                  />
                </IconButton>
                <IconButton
                  disabled={!currentNotification.id || currentNotification.id === notifications[notifications.length - 1]?.id}
                  onClick={() => handleNotificationNavigation('next')}
                >
                  <DirectionalIcon
                    ltrIconClass='ri-arrow-right-s-line'
                    rtlIconClass='ri-arrow-left-s-line'
                    className='text-textSecondary'
                  />
                </IconButton>
              </div>
            </div>
          </div>
          {currentNotification.id !== 'virtual-chat-unread' && (
            <div className='flex items-center justify-between gap-4 plb-2 pli-5 border-y text-textSecondary'>
              <div className='flex gap-1'>
                <Tooltip title={currentNotification.status === 'unread' ? dictionary.navigation.unread : dictionary.navigation.read} placement='top'>
                  <div>
                    <i
                      className={classnames(
                        'text-xl',
                        currentNotification.status === 'unread' ? 'ri-mail-unread-line text-primary' : 'ri-mail-open-line text-secondary'
                      )}
                    />
                  </div>
                </Tooltip>
              </div>
              <div className='flex gap-1'>
                {currentNotification.status === 'trash' ? (
                  <Tooltip title={dictionary.navigation.restore} placement='top'>
                    <IconButton onClick={async e => {
                      try {
                        const response = await fetch(`/api/notifications/${currentNotification.id}`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ status: 'read' }),
                        })

                        if (response.ok) {
                          dispatch(updateNotificationStatus({ notificationId: currentNotification.id, status: 'read' }))
                          setDrawerOpen(false)
                        }
                      } catch (error) {
                        console.error('Error restoring notification from trash:', error)
                      }
                    }}>
                      <i className='ri-refresh-line text-textSecondary' />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title={dictionary.navigation.trash} placement='top'>
                    <IconButton onClick={async e => {
                      try {
                        const response = await fetch(`/api/notifications/${currentNotification.id}`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ status: 'trash' }),
                        })

                        if (response.ok) {
                          dispatch(updateNotificationStatus({ notificationId: currentNotification.id, status: 'trash' }))
                          setDrawerOpen(false)
                        }
                      } catch (error) {
                        console.error('Error moving notification to trash:', error)
                      }
                    }}>
                      <i className='ri-delete-bin-line text-textSecondary' />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            </div>
          )}
          <ScrollWrapper isBelowLgScreen={isBelowLgScreen}>
            <div className='plb-5 pli-8 flex flex-col gap-4'>
              <div>
                <Card className='border mbs-4'>
                  <CardContent>
                    {currentNotification.id === 'virtual-chat-unread' ? (
                      <div>
                        <Typography variant='body1' className='whitespace-pre-wrap mb-4'>
                          {currentNotification.message?.split('<button')[0]}
                        </Typography>
                        <Button
                          variant='contained'
                          color='primary'
                          onClick={handleGoToChat}
                          startIcon={<i className='ri-wechat-line' />}
                        >
                          {dictionary.navigation.goToChat}
                        </Button>
                      </div>
                    ) : (
                      <Typography variant='body1' className='whitespace-pre-wrap'>
                        {currentNotification.message}
                      </Typography>
                    )}
                    {currentNotification.metadata && (
                      <div className='mt-4'>
                        <Typography variant='body2' color='text.secondary'>
                          Additional Information:
                        </Typography>
                        <pre className='mt-2 p-3 bg-grey-50 rounded text-sm overflow-auto'>
                          {JSON.stringify(currentNotification.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                  <CardActions className='pbs-0'>
                    <div className='flex items-center justify-end gap-4'>
                      <Typography variant='body2' color='text.disabled'>
                        {currentNotification.createdAt ? new Date(currentNotification.createdAt).toLocaleString() : 'Just now'}
                      </Typography>
                    </div>
                  </CardActions>
                </Card>
              </div>
            </div>
          </ScrollWrapper>
        </>
      )}
    </DetailsDrawer>
  )
}

export default NotificationDetails