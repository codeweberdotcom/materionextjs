'use client'

// MUI Imports
import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Type Imports
import type { UsersType } from '@/types/apps/userTypes'

// Component Imports
import RoleCards from './RoleCards'
import RolesTable from './RolesTable'

const Roles = ({ userData }: { userData?: UsersType[] }) => {
  const t = useTranslation()

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' className='mbe-1'>
          {t.navigation.rolesList}
        </Typography>
        <Typography>
          {t.navigation.rolesDescription}
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <RoleCards />
      </Grid>
      <Grid size={{ xs: 12 }} className='!pbs-12'>
        <Typography variant='h4' className='mbe-1'>
          {t.navigation.totalUsersWithRoles}
        </Typography>
        <Typography>{t.navigation.findAdministrators}</Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <RolesTable tableData={userData} />
      </Grid>
    </Grid>
  )
}

export default Roles
