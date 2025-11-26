// React Imports
'use client'
import { useState, useEffect, useMemo } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid2'

// Third-party Imports
import Skeleton from '@mui/material/Skeleton'

// Type Imports
import type { UserDataType } from '@components/card-statistics/HorizontalWithSubtitle'

// Component Imports
import HorizontalWithSubtitle from '@components/card-statistics/HorizontalWithSubtitle'
import { usePresence } from '@/contexts/PresenceProvider'
import { useUnreadByContact } from '@/hooks/useUnreadByContact'
import { useTranslation } from '@/contexts/TranslationContext'

// Vars
const staticData: UserDataType[] = [
  {
    title: 'Paid Users',
    stats: '4,567',
    avatarIcon: 'ri-user-add-line',
    avatarColor: 'error',
    trend: 'positive',
    trendNumber: '18%',
    subtitle: 'Last week analytics'
  },
  {
    title: 'Active Users',
    stats: '19,860',
    avatarIcon: 'ri-user-follow-line',
    avatarColor: 'success',
    trend: 'negative',
    trendNumber: '14%',
    subtitle: 'Last week analytics'
  },
  {
    title: 'Pending Users',
    stats: '237',
    avatarIcon: 'ri-user-search-line',
    avatarColor: 'warning',
    trend: 'positive',
    trendNumber: '42%',
    subtitle: 'Last week analytics'
  }
]

const UserListCards = () => {
  const [activeUsers, setActiveUsers] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const dictionary = useTranslation()
  const { statuses: presenceStatuses } = usePresence()
  const { userStatuses: unreadStatuses } = useUnreadByContact()

  const onlineCount = useMemo(() => {
    const ids = new Set<string>([...Object.keys(presenceStatuses || {}), ...Object.keys(unreadStatuses || {})])

    let count = 0

    ids.forEach(id => {
      let isOnline = presenceStatuses?.[id]?.isOnline

      if (isOnline === undefined) {
        isOnline = unreadStatuses?.[id]?.isOnline
      }

      if (isOnline) count += 1
    })

    return count
  }, [presenceStatuses, unreadStatuses])

  useEffect(() => {
    setActiveUsers(onlineCount)
    setLoading(false)
  }, [onlineCount])
  
  const data: UserDataType[] = [
    {
      title: dictionary.navigation.activeUsers || 'Active Users',
      stats: loading ? '...' : activeUsers.toString(),
      avatarIcon: 'ri-group-line',
      avatarColor: 'primary',
      subtitle: dictionary.navigation.onlineNow || 'Online now'
    },
    ...staticData
  ]

  if (loading) {
    return (
      <Grid container spacing={6}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <div className='p-5 border rounded-lg border-bs'>
              <div className='flex justify-between gap-1'>
                <div className='flex flex-col gap-1 flex-grow'>
                  <Skeleton width={120} height={20} />
                  <div className='flex items-center gap-2 flex-wrap'>
                    <Skeleton width={60} height={32} />
                  </div>
                  <Skeleton width={100} height={16} />
                </div>
                <Skeleton variant='circular' width={42} height={42} />
              </div>
            </div>
          </Grid>
        ))}
      </Grid>
    )
  }

  return (
    <Grid container spacing={6}>
      {data.map((item, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
          <HorizontalWithSubtitle {...item} />
        </Grid>
      ))}
    </Grid>
  )
}

export default UserListCards
