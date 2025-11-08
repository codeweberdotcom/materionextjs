// MUI Imports
import Grid from '@mui/material/Grid2'

// Type Imports
import type { UsersType } from '@/types/apps/userTypes'

// Component Imports
import UserDetails from './UserDetails'
import UserPlan from './UserPlan'

interface UserLeftOverviewProps {
  userData?: UsersType
}

const UserLeftOverview = ({ userData }: UserLeftOverviewProps) => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <UserDetails userData={userData} />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <UserPlan />
      </Grid>
    </Grid>
  )
}

export default UserLeftOverview
