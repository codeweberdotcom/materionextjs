'use client'

// React Imports
import { useState, useEffect } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid2'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import type { CardProps } from '@mui/material/Card'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Component Imports
import RoleDialog from '@components/dialogs/role-dialog'
import OpenDialogOnElementClick from '@components/dialogs/OpenDialogOnElementClick'

type Role = {
  id: string
  name: string
  description?: string | null
  permissions?: string | null
  createdAt: Date
  updatedAt: Date
}

type User = {
  id: string
  fullName: string
  avatar?: string
  role: string
}

type CardDataType = {
  title: string
  avatars: string[]
  totalUsers: number
}

// Vars
const cardData: CardDataType[] = [
  { totalUsers: 4, title: 'Administrator', avatars: ['1.png', '2.png', '3.png', '4.png'] },
  { totalUsers: 7, title: 'Editor', avatars: ['5.png', '6.png', '7.png'] },
  { totalUsers: 5, title: 'Users', avatars: ['4.png', '5.png', '6.png'] },
  { totalUsers: 6, title: 'Support', avatars: ['1.png', '2.png', '3.png'] },
  { totalUsers: 10, title: 'Restricted User', avatars: ['4.png', '5.png', '6.png'] }
]

const RoleCards = () => {
  // Hooks
  const t = useTranslation()

  // States
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])

  // Fetch roles and users
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolesResponse, usersResponse] = await Promise.all([
          fetch('/api/admin/roles'),
          fetch('/api/admin/users')
        ])

        if (rolesResponse.ok) {
          const rolesData = await rolesResponse.json()
          setRoles(rolesData)
        }

        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          setUsers(usersData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchData()
  }, [])

  const CardProps: CardProps = {
    className: 'cursor-pointer bs-full',
    children: (
      <Grid container className='bs-full'>
        <Grid size={{ xs: 5 }}>
          <div className='flex items-end justify-center bs-full'>
            <img alt='add-role' src='/images/illustrations/characters/1.png' height={130} />
          </div>
        </Grid>
        <Grid size={{ xs: 7 }}>
          <CardContent>
            <div className='flex flex-col items-end gap-4 text-right'>
              <Button variant='contained' size='small'>
                {t.navigation.addRole}
              </Button>
              <Typography>
                {t.navigation.addRoleDescription}
              </Typography>
            </div>
          </CardContent>
        </Grid>
      </Grid>
    )
  }

  return (
    <>
      <Grid container spacing={6} alignItems="stretch">
        {roles.map((role, index) => {
          const roleUsers = users.filter(user => user.role === role.name)
          return (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={role.id}>
              <Card>
                <CardContent className='flex flex-col gap-4'>
                  <div className='flex items-center justify-between'>
                    <Typography className='flex-grow'>{t.navigation.totalUsersCount.replace('${count}', roleUsers.length.toString())}</Typography>
                    <AvatarGroup total={Math.max(roleUsers.length, 1)}>
                      {roleUsers.slice(0, 3).map((user, userIndex) => (
                        <Avatar key={user.id} alt={user.fullName} src={user.avatar || undefined} />
                      ))}
                      {roleUsers.length === 0 && (
                        <Avatar>
                          <i className='ri-user-line' />
                        </Avatar>
                      )}
                    </AvatarGroup>
                  </div>
                  <div className='flex justify-between items-center'>
                    <div className='flex flex-col items-start gap-1'>
                      <Typography variant='h5'>{role.name}</Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {role.description || 'No description'}
                      </Typography>
                    </div>
                    <OpenDialogOnElementClick
                      element={IconButton}
                      elementProps={{
                        children: <i className='ri-edit-box-line text-secondary mui-1vkcxi3' />
                      }}
                      dialog={RoleDialog}
                      dialogProps={{ title: role.name }}
                    />
                  </div>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <OpenDialogOnElementClick element={Card} elementProps={CardProps} dialog={RoleDialog} />
        </Grid>
      </Grid>
    </>
  )
}

export default RoleCards
