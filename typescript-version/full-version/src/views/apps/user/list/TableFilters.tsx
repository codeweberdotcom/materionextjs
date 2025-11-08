// React Imports
import { useState, useEffect, useMemo } from 'react'

// MUI Imports
import CardContent from '@mui/material/CardContent'
import FormControl from '@mui/material/FormControl'
import Grid from '@mui/material/Grid2'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Type Imports
import type { UsersType } from '@/types/apps/userTypes'

type Role = {
  id: string
  name: string
  description?: string | null
  permissions?: string | null
  createdAt: Date
  updatedAt: Date
}

const TableFilters = ({ setData, tableData }: { setData: (data: UsersType[]) => void; tableData?: UsersType[] }) => {
  // Hooks
  const dictionary = useTranslation()

  // States
  const [role, setRole] = useState<UsersType['role']>('')
  const [plan, setPlan] = useState<UsersType['currentPlan']>('')
  const [status, setStatus] = useState<UsersType['status']>('')
  const [roles, setRoles] = useState<Role[]>([])

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch('/api/admin/roles')

        if (response.ok) {
          const rolesData = await response.json()

          setRoles(rolesData)
        }
      } catch (error) {
        console.error('Error fetching roles:', error)
      }
    }

    fetchRoles()
  }, []) // Empty dependency array is correct - we only want to fetch roles once on mount

  // Memoize filtered data to prevent unnecessary re-renders
  const filteredData = useMemo(() => {
    return tableData?.filter(user => {
      if (role && user.role !== role) return false
      if (plan && user.currentPlan !== plan) return false
      if (status && user.status !== status) return false

      return true
    }) || []
  }, [role, plan, status, tableData])

  // Update data only when filtered data changes
  useEffect(() => {
    setData(filteredData)
  }, [filteredData, setData])

  return (
    <CardContent>
      <Grid container spacing={5}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel id='role-select'>{dictionary.navigation.selectRoleFilter}</InputLabel>
            <Select
              fullWidth
              id='select-role'
              value={role}
              onChange={e => setRole(e.target.value)}
              label={dictionary.navigation.selectRoleFilter}
              labelId='role-select'
              inputProps={{ placeholder: dictionary.navigation.selectRoleFilter }}
            >
              <MenuItem value=''>{dictionary.navigation.selectRoleFilter}</MenuItem>
              {roles.map(role => (
                <MenuItem key={role.id} value={role.name}>
                  {role.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel id='plan-select'>{dictionary.navigation.selectPlanFilter}</InputLabel>
            <Select
              fullWidth
              id='select-plan'
              value={plan}
              onChange={e => setPlan(e.target.value)}
              label={dictionary.navigation.selectPlanFilter}
              labelId='plan-select'
              inputProps={{ placeholder: dictionary.navigation.selectPlanFilter }}
            >
              <MenuItem value=''>{dictionary.navigation.selectPlanFilter}</MenuItem>
              <MenuItem value='basic'>Basic</MenuItem>
              <MenuItem value='company'>Company</MenuItem>
              <MenuItem value='enterprise'>Enterprise</MenuItem>
              <MenuItem value='team'>Team</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth>
            <InputLabel id='status-select'>{dictionary.navigation.selectStatusFilter}</InputLabel>
            <Select
              fullWidth
              id='select-status'
              label={dictionary.navigation.selectStatusFilter}
              value={status}
              onChange={e => setStatus(e.target.value)}
              labelId='status-select'
              inputProps={{ placeholder: dictionary.navigation.selectStatusFilter }}
            >
              <MenuItem value=''>{dictionary.navigation.selectStatusFilter}</MenuItem>
              <MenuItem value='pending'>Pending</MenuItem>
              <MenuItem value='active'>Active</MenuItem>
              <MenuItem value='inactive'>Inactive</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </CardContent>
  )
}

export default TableFilters
