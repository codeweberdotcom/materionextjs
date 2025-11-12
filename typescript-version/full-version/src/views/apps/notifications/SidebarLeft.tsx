// React Imports
import { useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams } from 'next/navigation'

// MUI Imports
import Drawer from '@mui/material/Drawer'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'

// Third-party Imports
import classnames from 'classnames'
import PerfectScrollbar from 'react-perfect-scrollbar'

// Hook Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Redux Imports
import { useSelector } from 'react-redux'
import type { RootState } from '@/redux-store'

// Util Imports
import { getLocalizedUrl } from '@/utils/formatting/i18n'
import type { NotificationStatusFilter, NotificationTypeFilter } from '@/types/apps/notificationTypes'

// Styles Imports
import styles from './styles.module.css'

type Props = {
  isBelowLgScreen: boolean
  isBelowMdScreen: boolean
  isBelowSmScreen: boolean
  sidebarOpen: boolean
  setSidebarOpen: (value: boolean) => void
  status?: NotificationStatusFilter
  type?: NotificationTypeFilter
}

type LabelColor = {
  color: string
  colorClass: string
}

// Constants
const statusIcons = {
  all: 'ri-inbox-line',
  unread: 'ri-mail-line',
  read: 'ri-mail-open-line',
  archived: 'ri-archive-line'
}

const typeIcons = {
  all: 'ri-apps-line',
  system: 'ri-settings-line',
  chat: 'ri-wechat-line',
  security: 'ri-shield-check-line',
  user: 'ri-user-add-line',
  update: 'ri-refresh-line',
  error: 'ri-error-warning-line',
  feature: 'ri-star-line'
}

export const statusColors: { [key: string]: LabelColor } = {
  unread: { color: 'primary', colorClass: 'text-primary' },
  read: { color: 'secondary', colorClass: 'text-secondary' },
  archived: { color: 'error', colorClass: 'text-error' }
}

export const typeColors: { [key: string]: LabelColor } = {
  system: { color: 'info', colorClass: 'text-info' },
  chat: { color: 'success', colorClass: 'text-success' },
  security: { color: 'error', colorClass: 'text-error' },
  user: { color: 'warning', colorClass: 'text-warning' },
  update: { color: 'primary', colorClass: 'text-primary' },
  error: { color: 'error', colorClass: 'text-error' },
  feature: { color: 'success', colorClass: 'text-success' }
}

const ScrollWrapper = ({ children, isBelowLgScreen }: { children: ReactNode; isBelowLgScreen: boolean }) => {
  if (isBelowLgScreen) {
    return <div className='bs-full overflow-y-auto overflow-x-hidden'>{children}</div>
  } else {
    return <PerfectScrollbar options={{ wheelPropagation: false }}>{children}</PerfectScrollbar>
  }
}

const SidebarLeft = (props: Props) => {
  // Props
  const {
    isBelowLgScreen,
    isBelowMdScreen,
    isBelowSmScreen,
    sidebarOpen,
    setSidebarOpen,
    status,
    type
  } = props

  // Hooks
  const notifications = useSelector((state: RootState) => state.notificationsReducer.notifications)
  const { lang: locale } = useParams()
  const dictionary = useTranslation()

  // Calculate statistics
  const stats = notifications.reduce(
    (acc, notification) => {
      const notifStatus = notification.status ?? 'unread'
      const notifType = notification.type ?? 'system'

      acc.total += 1
      acc.byStatus[notifStatus] = (acc.byStatus[notifStatus] || 0) + 1
      acc.byType[notifType] = (acc.byType[notifType] || 0) + 1

      return acc
    },
    {
      total: 0,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>
    }
  )

  // Force re-render when notifications change
  const [, forceUpdate] = useState({})
  const triggerUpdate = useCallback(() => forceUpdate({}), [])

  // Refresh stats when notifications change
  useEffect(() => {
    // Force re-render when notifications change to update stats immediately
    triggerUpdate()
  }, [notifications.length, triggerUpdate])

  return (
    <Drawer
      open={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      className='bs-full'
      variant={!isBelowMdScreen ? 'permanent' : 'persistent'}
      ModalProps={{ disablePortal: true, keepMounted: true }}
      sx={{
        zIndex: isBelowMdScreen && sidebarOpen ? 11 : 10,
        position: !isBelowMdScreen ? 'static' : 'absolute',
        '& .MuiDrawer-paper': {
          boxShadow: 'none',
          overflow: 'hidden',
          width: '260px',
          position: !isBelowMdScreen ? 'static' : 'absolute'
        }
      }}
    >
      <CardContent>
        <Typography variant='h5' className='mbe-2'>{dictionary.navigation.notifications}</Typography>
        <Typography variant='body2' color='text.secondary'>
          {stats.total} {dictionary.navigation.totalNotifications}
        </Typography>
      </CardContent>
      <ScrollWrapper isBelowLgScreen={isBelowLgScreen}>
        <div className='flex flex-col gap-1 plb-4'>
          {Object.entries(statusIcons).map(([key, value]) => (
            <Link
              key={key}
              href={getLocalizedUrl(
                key === 'all'
                  ? `/apps/notifications`
                  : type
                    ? `/apps/notifications/status/${key}/type/${type}`
                    : `/apps/notifications/status/${key}`,
                locale as string
              )}
              prefetch
              className={classnames(
                'flex items-center justify-between plb-1 pli-5 gap-2.5 min-bs-8 bs-[32px] cursor-pointer',
                {
                  [styles.activeSidebarListItem]: key === (status || 'all')
                }
              )}
              onClick={() => console.log('Status clicked:', key)}
            >
              <div className='flex items-center gap-2.5'>
                <i className={classnames(value, 'text-xl')} />
                <Typography className='capitalize' color='inherit'>
                  {dictionary.navigation[key] || key}
                </Typography>
              </div>
              {stats.byStatus[key] && (
                <Chip
                  label={stats.byStatus[key]}
                  size='small'
                  variant='tonal'
                  color={
                    key === 'unread' ? 'primary' :
                    key === 'read' ? 'secondary' :
                    key === 'archived' ? 'error' : 'default'
                  }
                />
              )}
            </Link>
          ))}
        </div>
        <div className='flex flex-col gap-4 plb-4'>
          <Typography variant='caption' className='uppercase pli-5'>
            {dictionary.navigation.types}
          </Typography>
          <div className='flex flex-col gap-3'>
            {Object.entries(typeIcons).map(([key, value]) => (
              <Link
                key={key}
                href={getLocalizedUrl(
                  key === 'all'
                    ? `/apps/notifications`
                    : status
                      ? `/apps/notifications/status/${status}/type/${key}`
                      : `/apps/notifications/type/${key}`,
                  locale as string
                )}
                prefetch
                className={classnames('flex items-center gap-x-2 pli-5 cursor-pointer', {
                  [styles.activeSidebarListItem]: key === (type || 'all')
                })}
                onClick={() => console.log('Type clicked:', key)}
              >
                <i className={classnames(value, 'text-sm', typeColors[key]?.colorClass || 'text-textSecondary')} />
                <Typography className='capitalize' color='inherit'>
                  {dictionary.navigation[key] || key}
                </Typography>
              </Link>
            ))}
          </div>
        </div>
      </ScrollWrapper>
    </Drawer>
  )
}

export default SidebarLeft
