// React Imports
'use client'
import { useState, useEffect } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid2'

// Third-party Imports
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

// Type Imports
import type { UserDataType } from '@components/card-statistics/HorizontalWithSubtitle'

// Component Imports
import HorizontalWithSubtitle from '@components/card-statistics/HorizontalWithSubtitle'

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

  useEffect(() => {
    const fetchActiveUsers = async () => {
      try {
        const response = await fetch('/api/admin/users/active')
        if (response.ok) {
          const data = await response.json()
          setActiveUsers(data.activeUsers)
        }
      } catch (error) {
        console.error('Error fetching active users:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchActiveUsers()

    // Update every 30 seconds
    const interval = setInterval(fetchActiveUsers, 30000)

    return () => clearInterval(interval)
  }, [])

  const data: UserDataType[] = [
    {
      title: 'Активные пользователи',
      stats: loading ? '...' : activeUsers.toString(),
      avatarIcon: 'ri-group-line',
      avatarColor: 'primary',
      subtitle: 'Сейчас онлайн'
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
                <Skeleton circle width={42} height={42} />
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
