// React Imports
import type { ReactElement } from 'react'

// Next Imports
import dynamic from 'next/dynamic'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid2'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'

// Component Imports
import AccountSettings from '@views/pages/account-settings'

const TabSkeleton = () => (
  <Stack spacing={6}>
    <Card>
      <CardContent>
        <Stack spacing={4}>
          <Skeleton variant='text' height={32} width='30%' />
          <Grid container spacing={3}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Grid key={`skeleton-input-${index}`} size={{ xs: 12, md: 6 }}>
                <Stack spacing={2}>
                  <Skeleton variant='text' width='50%' height={20} />
                  <Skeleton variant='rectangular' height={48} />
                </Stack>
              </Grid>
            ))}
          </Grid>
          <Stack direction='row' spacing={2}>
            <Skeleton variant='rectangular' height={42} width={120} />
            <Skeleton variant='rectangular' height={42} width={120} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Skeleton variant='text' width='25%' height={28} />
          <Skeleton variant='rectangular' height={120} />
        </Stack>
      </CardContent>
    </Card>
  </Stack>
)

const AccountTab = dynamic(() => import('@views/pages/account-settings/account'), { loading: () => <TabSkeleton /> })
const SecurityTab = dynamic(() => import('@views/pages/account-settings/security'), { loading: () => <TabSkeleton /> })
const BillingPlansTab = dynamic(() => import('@views/pages/account-settings/billing-plans'), { loading: () => <TabSkeleton /> })
const NotificationsTab = dynamic(() => import('@views/pages/account-settings/notifications'), { loading: () => <TabSkeleton /> })
const ConnectionsTab = dynamic(() => import('@views/pages/account-settings/connections'), { loading: () => <TabSkeleton /> })

// Vars
const tabContentList = (): { [key: string]: ReactElement } => ({
  account: <AccountTab />,
  security: <SecurityTab />,
  'billing-plans': <BillingPlansTab />,
  notifications: <NotificationsTab />,
  connections: <ConnectionsTab />
})

const AccountSettingsPage = () => {
  return <AccountSettings tabContentList={tabContentList()} />
}

export default AccountSettingsPage
