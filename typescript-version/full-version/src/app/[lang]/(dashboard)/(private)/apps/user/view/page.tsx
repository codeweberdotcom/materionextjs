// React Imports
import type { ReactElement } from 'react'

// Next Imports
import dynamic from 'next/dynamic'
import { notFound } from 'next/navigation'

// MUI Imports
import Grid from '@mui/material/Grid2'

// Type Imports
import type { PricingPlanType } from '@/types/pages/pricingTypes'
import type { UsersType } from '@/types/apps/userTypes'

// Component Imports
import UserLeftOverview from '@views/apps/user/view/user-left-overview'
import UserRight from '@views/apps/user/view/user-right'

// Data Imports
import { getPricingData, getUserById } from '@/app/server/actions'

const OverViewTab = dynamic(() => import('@views/apps/user/view/user-right/overview'))
const SecurityTab = dynamic(() => import('@views/apps/user/view/user-right/security'))
const BillingPlans = dynamic(() => import('@views/apps/user/view/user-right/billing-plans'))
const NotificationsTab = dynamic(() => import('@views/apps/user/view/user-right/notifications'))
const ConnectionsTab = dynamic(() => import('@views/apps/user/view/user-right/connections'))

// Vars
const tabContentList = (data?: PricingPlanType[]): { [key: string]: ReactElement } => ({
  overview: <OverViewTab />,
  security: <SecurityTab />,
  'billing-plans': <BillingPlans data={data} />,
  notifications: <NotificationsTab />,
  connections: <ConnectionsTab />
})

/**
 * ! If you need data using an API call, uncomment the below API code, update the `process.env.API_URL` variable in the
 * ! `.env` file found at root of your project and also update the API endpoints like `/pages/pricing` in below example.
 * ! Also, remove the above server action import and the action itself from the `src/app/server/actions.ts` file to clean up unused code
 * ! because we've used the server action for getting our static data.
 */

/* const getPricingData = async () => {
  // Vars
  const res = await fetch(`${process.env.API_URL}/pages/pricing`)

  if (!res.ok) {
    throw new Error('Failed to fetch data')
  }

  return res.json()
} */

const UserViewTab = async ({ searchParams }: { searchParams: Promise<{ id: string }> }) => {
  // Vars
  const data = await getPricingData()

  // Get user ID from search params
  const params = await searchParams
  const userId = params?.id

  if (!userId) {
    notFound()
  }

  // Fetch specific user data
  const userData = await getUserById(userId)

  if (!userData) {
    notFound()
  }

  return (
    <div>
      <Grid container spacing={6}>
        <Grid size={{ xs: 12, lg: 4, md: 5 }}>
          <UserLeftOverview userData={userData} />
        </Grid>
        <Grid size={{ xs: 12, lg: 8, md: 7 }}>
          <UserRight tabContentList={tabContentList(data)} />
        </Grid>
      </Grid>
    </div>
  )
}

export default UserViewTab
